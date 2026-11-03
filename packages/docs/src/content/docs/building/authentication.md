---
title: Authentication
description: How sign-in, sessions, two-factor, passkeys, roles and permissions work in the API.
since: "0.1"
---

Everything here is in `packages/core/src`; each folder has a README with its endpoints.

## Sessions

Signing in creates a server-side session: the browser holds a random 256-bit token in the
httpOnly `lintel_session` cookie, the database holds its SHA-256 hash. Sessions last 30 days
from their last use. Deleting the row signs out instantly, which is how "sign out other
devices", deactivating someone and resetting a password take effect. See
`docs/decisions/0004-sessions-not-jwt.md`.

Passwords are hashed with scrypt (N=2^15, r=8, p=3) and need at least 12 characters.

## Signing in

| Request                                                                      | Answer                                                        |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `POST /auth/sign-in { email, password }`                                     | `{ user, permissions, enabledPlugins }` and the cookie        |
| ...when two-factor is on                                                     | `{ twoFactorRequired: true, challengeToken }`, no cookie      |
| `POST /auth/sign-in/two-factor { challengeToken, code }`                     | the session, as above; `recoveryCode` instead of `code` works |
| `POST /auth/passkey/options`, then `POST /auth/passkey/sign-in { response }` | the session                                                   |
| `POST /auth/sign-out`                                                        | 204                                                           |
| `GET /auth/me`                                                               | `{ user, permissions, enabledPlugins, mustSetUpTwoFactor? }`  |

- A wrong email and a wrong password give the same 401 in the same time.
- A deactivated account gets 403 `ACCOUNT_DEACTIVATED`, but only after the right password.
- The challenge token lasts 10 minutes and allows five wrong codes.
- Sign-in, the two-factor step, passkey sign-in and invitation links share a limit of 10
  requests a minute per IP address.

## Two-factor authentication

Codes are TOTP (RFC 6238: SHA-1, 30 seconds, six digits), accepted one step either side of
now. The step of the last accepted code is stored, so a code can't be used twice. Setting up
is two calls: `POST /account/two-factor/setup` returns the key, an `otpauth://` address and a
QR code as SVG; `POST /account/two-factor/confirm { code }` turns it on and returns ten
recovery codes, stored as hashes and usable once each.

A role with `requiresTwoFactor` sends its people into a restricted state: `/auth/me` carries
`mustSetUpTwoFactor: true`, and every route guarded by `requirePermission` answers 403
`TWO_FACTOR_SETUP_REQUIRED` until they turn it on. Their own `/account` routes keep working.

## Passkeys

WebAuthn through `@simplewebauthn/server`. The relying party is the admin's address
(`ADMIN_ORIGIN`): its host name is the passkey's site, and the origin must match exactly.
Passkeys are discoverable and require user verification, so they sign in on their own,
without a password or an app code. Each challenge is a one-time token that expires in five
minutes and is spent while it is checked.

## Forgotten passwords and email links

`POST /auth/forgot-password { email }` always answers 202 with the same message. For an
active account it emails `<admin>/reset-password#token=...`, valid once for 30 minutes (at
most three links per person per half hour; 5 requests per IP per 15 minutes).
`POST /auth/reset-password { token, newPassword }` changes the password and ends every
session. Invitation, reset and email-change tokens are random, stored only as SHA-256
hashes, and placed after `#` so they never reach a server log or a Referer header.

Email goes through `src/email`: `sendEmail(server, message)` with any `EmailSender` passed
to `buildServer({ email })`. Without one, messages are kept in memory and shown under
**Users → Security log → Emails sent**.

## Roles and permissions

A permission is `area:action`, such as `entries:publish`. Roles hold lists of them, with
wildcards (`entries:*`, `*`). Protect a route with a guard:

```ts
server.post("/things", { preHandler: requirePermission("things:update") }, handler);
server.get("/account/thing", { preHandler: requireAccountSession }, handler); // own account, no API tokens
```

Changing one entry uses `requireEntryPermission("update" | "publish" | "delete")` from
`src/entries/entry-access.ts`: it accepts `entries:update`, or `entries:update-own` when the
signed-in person created the entry. That is how the Author role works.

The built-in roles are in `src/roles/built-in-roles.ts`. The role editor's plain-English
names come from `src/roles/permission-catalog.ts`; a plugin adds its own by listing
`permissions` in its entry in `src/plugins/plugins.registry.ts`:

```ts
{
  id: "forms",
  // ...
  permissions: [{ permission: "forms:read", name: "See forms", description: "Forms and what people sent." }],
}
```

Rules enforced by the API, each with a test:

- Nobody can give a role, or add a permission to one, beyond what they can do themselves.
  Only owners hold `*`, so only owners make owners.
- The last active owner can't be demoted, deactivated or removed; only owners change owners.
- Removing someone moves their entries, revisions, uploads and webhooks to a person you name.
- A deactivated person's sessions end and their API tokens stop working.

## The security log

`recordSecurityEvent` writes to `security_events`: sign-ins, failures, and changes to
people, roles, two-factor, passkeys, sessions and API tokens. `GET /security-log` lists it
(`security:read`); `GET /security-log/export` downloads CSV with formula-looking values
defused.
