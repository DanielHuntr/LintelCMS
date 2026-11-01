# Sessions

A session is one signed-in browser. Signing in starts one; signing out ends it.

## How it works

1. On sign-in, `startSession` makes a random 256-bit token. The browser gets the token
   in the `__Host-lintel_session` cookie (`lintel_session` in development); the database gets only its SHA-256 hash.
2. On each request that needs a signed-in user, `findActiveSession` hashes the cookie
   and looks it up. Expired sessions are deleted when found.
3. Sessions last 30 days from their last use. To avoid a database write on every
   request, the expiry is pushed forward at most once a day (`wasExtended` tells the
   caller to renew the cookie as well).
4. `endSession` deletes the row, so signing out takes effect immediately everywhere.
5. `endAllSessionsForUser` deletes all of a user's sessions; resetting a password and
   deactivating someone use it, so access stops on every device at once.
6. `listUserSessions`, `endUserSession` and `endOtherSessions` are behind "Where you're
   signed in" on the account page (see `src/account`). `describe-user-agent.ts` turns a
   user-agent into "Firefox on Windows" for that list.

Why sessions rather than JWTs: see `docs/decisions/0004-sessions-not-jwt.md`.

## Files

| File                     | What it does                           |
| ------------------------ | -------------------------------------- |
| `sessions.table.ts`      | The `sessions` table                   |
| `sessions.service.ts`    | Start, find (with sliding expiry), end |
| `sessions.repository.ts` | Database reads and writes              |

The cookie itself, and the HTTP routes, live in `src/auth`.
