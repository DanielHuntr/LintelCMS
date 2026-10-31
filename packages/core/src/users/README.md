# Users

People who sign in to the admin. (Shoppers and site members will get their own table.)

| File                  | What it does                                             |
| --------------------- | -------------------------------------------------------- |
| `users.table.ts`      | The `users` table                                        |
| `users.schema.ts`     | Email and new-password rules; the public shape of a user |
| `users.service.ts`    | `createAdmin` (Super admin role) and `resetPassword`     |
| `closest-email.ts`    | "Did you mean ...?" for an email that isn't found        |
| `users.repository.ts` | Database reads and writes                                |

Emails are stored lowercased and trimmed (see `emailSchema`) and are unique per tenant.
Passwords are stored only as scrypt hashes (see `src/auth/passwords.ts`).
The first admin is created on the setup screen (see `src/setup`), or with
`pnpm create-admin` (see `src/scripts`). `resetPassword` also ends all the user's
sessions, so the old password stops working everywhere at once.
