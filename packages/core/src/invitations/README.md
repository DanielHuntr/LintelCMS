# Invitations

How new people join: an admin invites an email address with a role; the person opens the
link, chooses their name and password, and is signed in with that role.

- Links look like `<admin>/accept-invitation#token=...` and work for 7 days. Only a SHA-256
  hash of the token is stored; the token is after `#`, so it never reaches a server log.
- Resending makes a new token and a new 7 days; the old link stops working. Inviting the
  same address again does the same, with the new role.
- The link is also returned, once, to whoever sent it (`invitationUrl`), so they can pass
  it on themselves while email isn't set up.
- Accepting deletes the invitation in the same transaction that creates the account, so
  a link can't be used twice.
- Nobody can invite someone with a role that allows more than they can do (only owners
  invite owners). An email that already has an account gives 409.

Emails go through `src/email`.

## Endpoints

| Method and path                | Permission     | Body / success                                                              |
| ------------------------------ | -------------- | --------------------------------------------------------------------------- |
| `GET /invitations`             | `users:read`   | 200 `{ invitations: [{ id, email, role, invitedBy, expiresAt, expired }] }` |
| `POST /invitations`            | `users:invite` | `{ email, roleId }` 201 `{ invitation, invitationUrl }`                     |
| `POST /invitations/:id/resend` | `users:invite` | 200 `{ invitation, invitationUrl }`                                         |
| `DELETE /invitations/:id`      | `users:invite` | 204                                                                         |
| `POST /invitations/preview`    | anyone         | `{ token }` 200 `{ email, roleName, invitedByName }`; 400 if expired        |
| `POST /invitations/accept`     | anyone         | `{ token, name, password }` 200 `{ user, permissions }` and cookie          |

The two public endpoints share sign-in's limit of 10 a minute per IP address.

## Files

| File                        | What it does                                |
| --------------------------- | ------------------------------------------- |
| `invitations.table.ts`      | The `invitations` table                     |
| `invitations.schema.ts`     | Request and response schemas                |
| `invitations.service.ts`    | Inviting, resending, revoking and accepting |
| `invitations.repository.ts` | Database reads and writes                   |
| `invitations.routes.ts`     | The endpoints                               |
| `invitations.errors.ts`     | Named errors                                |
