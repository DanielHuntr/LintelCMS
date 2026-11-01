# Scripts

Command-line tasks. Each script only reads its input and calls a service, so the rules
stay in the feature folders. Run them from the repository root:

| Script              | Command                                             | What it does                                       |
| ------------------- | --------------------------------------------------- | -------------------------------------------------- |
| `create-admin.ts`   | `pnpm create-admin --email <email> --name "<name>"` | Creates a Super admin (role `["*"]`)               |
| `reset-password.ts` | `pnpm reset-password --email <email>`               | New password for a user; signs them out everywhere |
| `migrate.ts`        | `pnpm db:migrate`                                   | Creates or updates the tables now                  |

Most people never need `create-admin`: the setup screen creates the first admin. Nor
`db:migrate`: the server migrates on every start.

Passwords are asked for without echoing them (twice, to catch typos), or read from
`LINTEL_ADMIN_PASSWORD` / `LINTEL_NEW_PASSWORD` for automated setups. They must be at
least 12 characters and not easy to guess (the same check as the setup screen, see
`src/auth/password-strength.ts`); a weak one is refused with a tip and nothing changes. If `reset-password` doesn't know the email, it suggests the closest
one it does.

Scripts use the same database as the server (`DATABASE_URL`, then the setup screen's
choice, then the built-in database). The built-in database can only be open in one
program at a time, so stop `pnpm dev` first; the script says so if you forget.
Connection problems are explained in one sentence rather than a stack trace.

The root shortcuts pass everything after the command name straight through (`pnpm
create-admin --email ...`). The long form `pnpm --filter @lintel/core create-admin ...`
works too.

`read-new-password.ts` and `prompt-password.ts` are the shared password prompts.
