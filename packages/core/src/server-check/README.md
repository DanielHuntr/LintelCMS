# Server check

"Check this server": whether the machine Lintel runs on has what it needs, in plain English,
with the questions to ask the hosting company when something is missing.

| Check             | Fails or warns when                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| Node.js version   | Older than 22                                                                                                |
| Memory            | Under 512 MB (fails), or under 1 GB (a note)                                                                 |
| Built-in database | The account limits virtual memory (only shown when it is the database)                                       |
| Database          | Lintel can't reach it, or Postgres is older than 14                                                          |
| Saving files      | Lintel can't write to its folder or its data folder                                                          |
| Image resizing    | sharp isn't installed or can't load                                                                          |
| Internet access   | An HTTPS request to the npm registry gets no answer (email services, payments, webhooks and updates need it) |

The first five come from the hosting checker, `src/hosting/files/lintel-check.cjs`, one
plain file people can upload before installing anything; `server-check.service.ts` runs it
inside Lintel and adds the database Lintel really uses.

- `GET /system/server-check` (`updates:read`): the report, for Settings → This server.
- `lintel check` (or `pnpm lintel check`): the same report in a terminal, plus Lintel's
  settings and the built admin (see `src/cli/doctor-command.ts`). It exits with 1 when
  something stops Lintel working.

| File                      | What it does                                     |
| ------------------------- | ------------------------------------------------ |
| `server-check.service.ts` | The report: the hosting checker and the database |
| `server-check.routes.ts`  | `GET /system/server-check`                       |
