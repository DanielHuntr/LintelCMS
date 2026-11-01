# Auth

Signing in to the admin, signing out, and checking what the signed-in person may do.

## Endpoints

| Method and path       | Body                  | Success                                    | Failure                                  |
| --------------------- | --------------------- | ------------------------------------------ | ---------------------------------------- |
| `POST /auth/sign-in`  | `{ email, password }` | 200 signed-in details (below), sets cookie | 400 bad body, 401 no match, 429 too many |
| `POST /auth/sign-out` | none                  | 204, clears cookie (fine if signed out)    |                                          |
| `GET /auth/me`        | none                  | 200 signed-in details (below)              | 401 signed out or session expired        |

`user` is `{ id, email, name }`. `permissions` is every permission from all the user's
roles, without duplicates, sorted. `enabledPlugins` lists the ids of the plugins that are
switched on (see `src/plugins`), so the admin knows which sections to show. The signed-in
details are `{ user, permissions, enabledPlugins, siteName }`; `siteName` is the site's name
from setup (null before then), for the browser tab and the sidebar.

The first admin is created by `POST /setup/finish` (see `src/setup`), which starts a session the
same way, through `startSignedInSession`. Errors look like
`{ statusCode, code, error, message }` (see `src/http/README.md`).

Wrong email and wrong password give the same 401 and take about the same time, so
sign-in can't be used to find out who has an account. Sign-in is limited to 10 attempts
a minute per IP address.

## The session cookie

`lintel_session`: httpOnly, SameSite=Lax, Path=/, Secure except when
`NODE_ENV=development`, expires with the session (30 days, extended on use).
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
