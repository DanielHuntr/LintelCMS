# 4. Server-side sessions with hashed tokens, not JWTs

Date: 2026-10-31

## Decision

Signing in creates a row in the `sessions` table and gives the browser a random 256-bit
token in an httpOnly cookie (`lintel_session`). The table stores only a SHA-256 hash of the
token. Every request that needs a signed-in user looks the session up. Sessions last 30
days from last use; the expiry moves forward at most once a day.

Passwords are hashed with Node's built-in scrypt.

## Why

- **Signing out works instantly.** Deleting the row ends the session everywhere, at once.
  The same goes for removing a user or (later) "sign out of all devices". A JWT stays valid
  until it expires unless we add a deny-list, which is a session table by another name.
- **Permission changes apply on the next request.** Permissions are read from the user's
  roles each time, not frozen into a token at sign-in.
- **Simple to run.** There is no signing key to generate, store, rotate or leak. A
  self-hosted install needs nothing beyond the Postgres it already has.
- **A leaked database can't be used to sign in.** Only token hashes are stored. The token
  is random, so a fast hash is enough; there is nothing to guess.
- **The cost is small.** One indexed lookup per request is cheap at the scale of an admin
  panel, and the once-a-day extension keeps writes rare.

scrypt is built into Node, so there is no native module to compile on a customer's server,
and its cost settings are stored with each hash so they can be raised later.

## Alternatives considered

- **JWTs in a cookie**: no lookup per request, but no instant revocation, stale permissions,
  and a signing key to manage. Their main benefit, verifying without a shared database,
  matters for many independent services; Lintel is one API with one database.
- **A library such as Better Auth or Lucia**: worth revisiting for passkeys, two-factor and
  single sign-on. For email and password alone, the code here is short and fully ours.
- **Argon2 or bcrypt for passwords**: good choices, but both need a native module (or a
  slower WebAssembly build). scrypt is comparably strong and ships with Node.
