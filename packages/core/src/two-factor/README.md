# Two-factor authentication

Codes from an authenticator app (TOTP, RFC 6238: SHA-1, 30 seconds, six digits), plus ten
recovery codes for a lost phone.

1. `POST /account/two-factor/setup` makes a key and returns it with an `otpauth://` address
   and a QR code (SVG). It is kept as `pendingSecret` until confirmed.
2. `POST /account/two-factor/confirm { code }` checks a code against it, turns two-factor on
   and returns the recovery codes, once. Only their hashes are kept.
3. From then on, signing in asks for a code after the password (see `src/auth`).

Codes one 30-second step either side of now are accepted. `lastUsedStep` remembers the last
accepted one, and is claimed with a compare-and-set, so the same code can't sign in twice.

## Required by a role

A role with **Require two-factor authentication** (`requiresTwoFactor`) puts its people who
haven't turned it on into a restricted state: `mustSetUpTwoFactor` in their session, and 403
`TWO_FACTOR_SETUP_REQUIRED` from every permission-guarded route until they do. They can't
turn it off while the role requires it.

## Endpoints

All act on the signed-in person's own account, with a browser session.

| Method and path                           | Body           | Success                                    |
| ----------------------------------------- | -------------- | ------------------------------------------ |
| `GET /account/two-factor`                 |                | `{ enabled, required, recoveryCodesLeft }` |
| `POST /account/two-factor/setup`          |                | `{ secret, otpauthUrl, qrCodeSvg }`        |
| `POST /account/two-factor/confirm`        | `{ code }`     | `{ recoveryCodes }`; 10 tries a minute     |
| `POST /account/two-factor/disable`        | `{ password }` | 204; 409 when a role requires it           |
| `POST /account/two-factor/recovery-codes` | `{ password }` | `{ recoveryCodes }`, replacing the old     |

## Files

| File                       | What it does                                      |
| -------------------------- | ------------------------------------------------- |
| `two-factor.table.ts`      | The `two_factor` and `recovery_codes` tables      |
| `totp.ts`                  | Making keys and codes, checking codes             |
| `recovery-codes.ts`        | Making and hashing recovery codes                 |
| `two-factor.schema.ts`     | Request and response schemas                      |
| `two-factor.service.ts`    | Setting up, checking a second factor, turning off |
| `two-factor.repository.ts` | Database reads and writes                         |
| `two-factor.routes.ts`     | The endpoints                                     |
| `two-factor.errors.ts`     | Named errors                                      |
