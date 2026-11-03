# API tokens

Keys that websites, apps and scripts send as `Authorization: Bearer <token>`. Admins make
them in Build → API access.

- **Shown once, stored hashed.** A token is `lintel_` and 43 random characters. Only its
  SHA-256 hash and its first few characters (`tokenStart`, to tell tokens apart) are kept.
  Tokens are long and random, so a fast hash is enough; slow hashing is for passwords.
- **Two kinds.** `read` sees published content (delivery and GraphQL), the content model
  and the media library, but no drafts: read tokens end up in websites' code, and a leaked
  one shouldn't show unpublished work. `readWrite` may also read drafts, and create, edit,
  publish and delete entries and media, through the management API and GraphQL previews.
  Neither reaches settings, users or roles.
- **Never more than their maker.** A token acts for the admin who made it (revisions and
  "updated by" show their name), and its permissions are cut down to what that admin may
  do. Deleting the admin deletes their tokens.
- **Where they work.** `requirePermission` (src/auth) accepts a token when there is no
  session cookie, so every management route works with one. The delivery and GraphQL APIs
  accept them too (see src/delivery). A token that is sent but unknown is a 401
  `INVALID_API_TOKEN`, never a quiet fall back to public access.
- **Apps use the same door.** An installed app's client secret (`lintelapp_...`) is read by
  `api-token-auth.ts` too, and checked by `src/apps` against the scopes the app was given.

## Endpoints

| Method and path          | Permission        | Body               | Success                      |
| ------------------------ | ----------------- | ------------------ | ---------------------------- |
| `GET /api-tokens`        | `settings:read`   | none               | 200 `{ tokens: [ApiToken] }` |
| `POST /api-tokens`       | `settings:update` | `{ name, access }` | 201 `{ token, secret }`      |
| `DELETE /api-tokens/:id` | `settings:update` | none               | 204                          |

`ApiToken = { id, name, access, tokenStart, createdAt, lastUsedAt, createdBy }`.
`lastUsedAt` is written at most once a minute per token.

## Files

| File                       | What it does                                     |
| -------------------------- | ------------------------------------------------ |
| `api-tokens.table.ts`      | The `api_tokens` table                           |
| `api-tokens.schema.ts`     | Zod schemas for requests and responses           |
| `api-tokens.routes.ts`     | The endpoints                                    |
| `api-tokens.service.ts`    | Making, listing, deleting and checking tokens    |
| `api-tokens.repository.ts` | Database reads and writes                        |
| `api-token-access.ts`      | What each kind of token may do                   |
| `api-token-secrets.ts`     | Making, hashing and reading tokens               |
| `api-token-auth.ts`        | The token on a request, checked once per request |
| `api-tokens.errors.ts`     | Named errors with the messages people see        |
