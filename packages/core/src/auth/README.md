# Auth

Signing in to the admin, signing out, and checking what the signed-in person may do.

## Endpoints

| Method and path                 | Body                                                             | Success                                    | Failure                                                   |
| ------------------------------- | ---------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------- |
| `POST /auth/sign-in`            | `{ email, password }`                                            | 200 signed-in details (below), sets cookie | 400 bad body, 401 no match, 403 deactivated, 429 too many |
| `POST /auth/sign-out`           | none                                                             | 204, clears cookie (fine if signed out)    |                                                           |
| `GET /auth/me`                  | none                                                             | 200 signed-in details (below)              | 401 signed out or session expired                         |
| `POST /auth/sign-in/two-factor` | `{ challengeToken, code }` or `{ challengeToken, recoveryCode }` | 200 as above, sets cookie                  | 401 wrong code or `SIGN_IN_EXPIRED`, 429                  |

`user` is `{ id, email, name }`. `permissions` is every permission from all the user's
roles, without duplicates, sorted. `enabledPlugins` lists the ids of the plugins that are
switched on (see `src/plugins`), so the admin knows which sections to show. The signed-in
details are `{ user, permissions, enabledPlugins, siteAddress, siteName }`, plus
`mustSetUpTwoFactor: true` when one of the person's roles requires two-factor and they haven't
turned it on. `siteAddress` is the website's address for "View page" ("" until one is
connected); `siteName` is the site's name from setup (null before then), for the browser tab
and the sidebar.

Every way of signing in (password, two-factor code, passkey, accepting an invitation) gives
the browser its new session through `replaceBrowserSession` (`browser-session.ts`), which ends
any session the browser already had rather than carrying it on.

The first admin is created by `POST /setup/finish` (see `src/setup`), which starts a session the
same way, through `startSignedInSession`. Errors look like
`{ statusCode, code, error, message }` (see `src/http/README.md`).

With two-factor authentication on (see `src/two-factor`), a correct password answers
`{ twoFactorRequired: true, challengeToken }` without a cookie. The challenge lasts ten
minutes and allows five wrong codes. Passkey sign-in is in `src/passkeys`, and forgotten
passwords in `src/password-reset`. Every sign-in and failure goes to the security log.

Wrong email and wrong password give the same 401 and take about the same time, so
sign-in can't be used to find out who has an account. Sign-in is limited to 10 attempts
a minute per IP address.

## The session cookie

`__Host-lintel_session`: httpOnly, SameSite=Lax, Path=/, Secure, expires with the session
(30 days, extended on use). The `__Host-` prefix means browsers only accept it from the
API's own host, so a page on a sibling subdomain can't plant a session of its own. With
`NODE_ENV=development` (plain HTTP) it is called `lintel_session` and isn't Secure, because
browsers refuse the prefix without HTTPS.

Signing in always starts a new session and ends the one the browser already had.

Requests that change something (POST, PUT, PATCH, DELETE) must come from the admin's
address or the API's own, checked with the `Origin` header, unless they carry an API token.
That stops other websites, including ones on the same domain, from forging requests with an
editor's cookie. See `src/http/cross-site-requests.ts`.
Browsers must send it, so the admin calls the API with `credentials: "include"`.
How sessions are stored and extended: `src/sessions/README.md`.

## Protecting a route

```ts
server.post(
  "/entries/:id/publish",
  { preHandler: requirePermission("entries:publish") },
  async (request) => {
    const { user } = getSignedIn(request);
    // ...
  },
);
```

- `requirePermission(permission)` gives 401 when signed out, 403 when not allowed.
- `requireSignedIn` only checks that someone is signed in.
- `requireAccountSession` is for a person's own account: it needs the browser session, so
  an API token can't change the password of the admin who made it.
- Someone whose role requires two-factor and who hasn't turned it on (`mustSetUpTwoFactor`
  in the session) gets 403 `TWO_FACTOR_SETUP_REQUIRED` from every `requirePermission` route.
- Changing one entry uses `requireEntryPermission` (see `src/entries/entry-access.ts`), which
  also accepts the "-own" permissions for entries the person created.
- Both set `request.signedIn` to `{ user, permissions }`; `getSignedIn(request)` reads it.

## Files

| File                    | What it does                                                    |
| ----------------------- | --------------------------------------------------------------- |
| `auth.routes.ts`        | The three endpoints and the sign-in rate limit                  |
| `auth.service.ts`       | Sign in, sign out, find who a session belongs to                |
| `auth.schema.ts`        | Zod schemas for the sign-in request and the response            |
| `auth.errors.ts`        | Named errors with the messages people see                       |
| `require-permission.ts` | Route guards: `requireSignedIn`, `requirePermission`            |
| `session-cookie.ts`     | Reading, setting and clearing the cookie                        |
| `passwords.ts`          | scrypt hashing and constant-time checking                       |
| `password-strength.ts`  | How guessable a new password is (zxcvbn), shared with the admin |

## New passwords

Every new password needs at least 12 characters and a zxcvbn score of 3 ("Good") or more,
counting the person's name and email as easy guesses. `password-strength.ts` holds the rule
and returns plain data (`level`, `filledSegments`, `tip`, `isStrongEnough`). The admin
imports the same file as `@lintel/core/password-strength` for its strength meter, so the
two can't disagree. On the server, `requireStrongPassword` (users.service.ts) runs wherever
a password is set (setup, `create-admin`, `reset-password`) and throws `WeakPasswordError`:
a 400 `INVALID_REQUEST` whose message starts "That password would be too easy to guess",
with the same text in `fields.password`.

zxcvbn-ts and its dictionaries are MIT licensed. The checker is built on first use, because
loading the dictionaries takes a moment.
