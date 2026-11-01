# Account

The signed-in person's own account: their name and picture, their email, their password
and the devices they're signed in on. Two-factor authentication is in `src/two-factor` and
passkeys in `src/passkeys`; both live under `/account/...` too.

Every route uses `requireAccountSession`: a browser session is needed, so an API token can't
be used to change the password of the admin who made it.

- **Email changes** send a link to the new address (24 hours, once) and a note to the old
  one. Nothing changes until the link is opened; then the old address is told again.
- **Password changes** ask for the current password, and sign out every other device.
- **Picture** is an image from the media library (`avatarAssetId`).

## Endpoints

| Method and path                          | Body                               | Success                                                |
| ---------------------------------------- | ---------------------------------- | ------------------------------------------------------ |
| `GET /account`                           |                                    | `{ id, email, name, avatar, pendingEmail, roles }`     |
| `PATCH /account`                         | `{ name?, avatarAssetId? }`        | the account                                            |
| `POST /account/email`                    | `{ newEmail, password }`           | 202, link sent                                         |
| `POST /account/email/confirm` (anyone)   | `{ token }`                        | 204                                                    |
| `POST /account/password`                 | `{ currentPassword, newPassword }` | `{ endedSessions }`                                    |
| `GET /account/sessions`                  |                                    | `{ sessions: [{ id, browser, lastUsedAt, current }] }` |
| `DELETE /account/sessions/:id`           |                                    | 204                                                    |
| `POST /account/sessions/sign-out-others` |                                    | `{ endedSessions }`                                    |

## Files

| File                 | What it does                                  |
| -------------------- | --------------------------------------------- |
| `account.schema.ts`  | Request and response schemas                  |
| `account.service.ts` | Profile, email change, password, sessions     |
| `account.routes.ts`  | The endpoints, and their security log entries |
| `account.errors.ts`  | Named errors                                  |

There is no table or repository of its own: it reads and writes through `src/users`,
`src/sessions` and `src/one-time-tokens`.
