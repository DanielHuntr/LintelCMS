# Users

People who sign in to the admin, and the Users screen's rules. (Shoppers and site members
will get their own table.)

## The rules

`user-management.service.ts` holds them, each with a test in `user-management.test.ts`:

- The last **active** owner can't be demoted, deactivated or removed.
- Only owners can change an owner. Nobody can give a role that allows more than they can do
  themselves (`checkRoleCanBeGranted` in `src/roles`), so only owners make owners.
- Nobody deactivates or removes their own account.
- Deactivating sets `status` to "deactivated", ends every session and stops their API
  tokens; their content stays. Reactivating undoes it.
- Removing first moves their entries, revisions, uploads and webhooks to another active
  person (`authorship.repository.ts`), then deletes the account.

New people join through `src/invitations`. Emails are stored lowercased and trimmed (see
`emailSchema`) and are unique per tenant. Passwords are stored only as scrypt hashes (see
`src/auth/passwords.ts`). The first admin is created on the setup screen (see `src/setup`),
or with `pnpm create-admin`, as an Owner. `resetPassword` (for `pnpm reset-password`) also
ends all the user's sessions.

## Endpoints

| Method and path              | Permission     | Body / success                                        |
| ---------------------------- | -------------- | ----------------------------------------------------- |
| `GET /users`                 | `users:read`   | `?search` 200 `{ users: [UserListItem] }`             |
| `GET /users/:id`             | `users:read`   | 200 `UserListItem`                                    |
| `PUT /users/:id/role`        | `users:update` | `{ roleId }` 200; 403 `OWNERS_ONLY`, 409 `LAST_OWNER` |
| `POST /users/:id/deactivate` | `users:update` | 200; 409 `OWN_ACCOUNT` or `LAST_OWNER`                |
| `POST /users/:id/reactivate` | `users:update` | 200                                                   |
| `DELETE /users/:id`          | `users:delete` | `{ reassignToUserId }` 204                            |

A `UserListItem` is `{ id, email, name, status, roles, avatarUrl, twoFactorEnabled,
lastActiveAt, createdAt }`. Every change is written to the security log.

## Files

| File                         | What it does                                                    |
| ---------------------------- | --------------------------------------------------------------- |
| `users.table.ts`             | The `users` table                                               |
| `users.schema.ts`            | Email, name and new-password rules; request and response shapes |
| `users.service.ts`           | `createAdmin` (Owner role) and `resetPassword`                  |
| `user-management.service.ts` | Listing, changing roles, deactivating and removing              |
| `users.routes.ts`            | The endpoints                                                   |
| `users.errors.ts`            | Named errors with the messages people see                       |
| `authorship.repository.ts`   | Moving someone's content to another person                      |
| `closest-email.ts`           | "Did you mean ...?" for an email that isn't found               |
| `users.repository.ts`        | Database reads and writes                                       |
