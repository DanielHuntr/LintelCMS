# Passkeys

An optional way to sign in: a key pair kept on a phone, laptop or security key, unlocked
with a fingerprint, face or PIN. Lintel stores only the public key. People add passkeys on
their account page and choose **Sign in with a passkey** on the sign-in screen.

The cryptography is done by `@simplewebauthn/server`. This folder decides which challenges
are valid and who a passkey belongs to:

1. `POST .../options` makes a random challenge, kept as a one-time token (`src/one-time-tokens`)
   for five minutes.
2. The browser asks the authenticator, which signs the challenge.
3. The answer is verified against the admin's address (`ADMIN_ORIGIN` gives the origin and
   the relying party id, its host name). The challenge is spent while verifying, so an
   answer can't be used twice.

User verification is required, so a passkey counts as two factors: signing in with one
skips the password and the authenticator app code. Passkeys are discoverable, so sign-in
doesn't ask for an email first. A deactivated account can't sign in with a passkey.

## Endpoints

| Method and path                  | Who       | Body / success                                            |
| -------------------------------- | --------- | --------------------------------------------------------- |
| `GET /account/passkeys`          | signed in | 200 `{ passkeys: [{ id, name, createdAt, lastUsedAt }] }` |
| `POST /account/passkeys/options` | signed in | 200 WebAuthn creation options                             |
| `POST /account/passkeys`         | signed in | `{ name, response }` 201 the passkey; 400 if not valid    |
| `DELETE /account/passkeys/:id`   | signed in | 204                                                       |
| `POST /auth/passkey/options`     | anyone    | 200 WebAuthn request options (10 a minute per IP)         |
| `POST /auth/passkey/sign-in`     | anyone    | `{ response }` 200 `{ user, permissions }` and cookie     |

## Files

| File                     | What it does                                |
| ------------------------ | ------------------------------------------- |
| `passkeys.table.ts`      | The `passkeys` table                        |
| `passkeys.schema.ts`     | Request and response schemas                |
| `passkeys.service.ts`    | Registration, sign-in, listing and removing |
| `passkeys.repository.ts` | Database reads and writes                   |
| `passkeys.routes.ts`     | The endpoints                               |
| `passkeys.errors.ts`     | Named errors with the messages people see   |
