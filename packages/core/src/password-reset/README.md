# Password reset

"Forgot your password?" on the sign-in screen.

1. `POST /auth/forgot-password { email }` always answers 202 with the same message. When the
   email belongs to an active account, it also emails a link to
   `<admin>/reset-password#token=...`. The token is after `#`, so browsers never send it to
   a server or in a Referer header.
2. The link works once, for 30 minutes. Only its SHA-256 hash is stored (`src/one-time-tokens`).
3. `POST /auth/reset-password { token, newPassword }` sets the password, spends every reset
   link the person has, ends all their sessions and emails them that it happened.

## Not giving anything away

- The answer to step 1 is identical for known and unknown addresses, and takes the same
  time: the email is sent in the background (`sendEmail` never waits).
- At most three links per person per half hour are sent; more requests get the same answer.
- Per IP address: 5 link requests and 10 resets per 15 minutes, then 429.

Admins locked out with no email set up can still use `pnpm reset-password` (see `src/scripts`).

## Endpoints

| Method and path                   | Body                     | Success           | Failure                       |
| --------------------------------- | ------------------------ | ----------------- | ----------------------------- |
| `POST /auth/forgot-password`      | `{ email }`              | 202 `{ message }` | 400 bad email, 429            |
| `POST /auth/reset-password/check` | `{ token }`              | 200 `{ usable }`  | 429                           |
| `POST /auth/reset-password`       | `{ token, newPassword }` | 204               | 400 `RESET_LINK_INVALID`, 429 |

## Files

| File                        | What it does                        |
| --------------------------- | ----------------------------------- |
| `password-reset.schema.ts`  | Request schemas                     |
| `password-reset.service.ts` | Sending links and resetting         |
| `password-reset.routes.ts`  | The endpoints and their rate limits |
| `password-reset.errors.ts`  | Named errors                        |

There is no repository of its own: tokens are in `src/one-time-tokens`, users in `src/users`.
