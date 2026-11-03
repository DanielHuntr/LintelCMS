# Security log

A record of sign-ins, failed sign-ins and every change to people, roles, two-factor
settings, passkeys and API tokens. Admins read it under **Users → Security log** and
can download it as CSV.

Features write to it after something has happened:

```ts
await recordSecurityEvent(server.database, {
  kind: "role-changed",
  actor: { id: admin.id, email: admin.email },
  subject: { id: user.id, name: user.name },
  origin: requestOrigin(request),
  details: { from: "Editor", to: "Admin" },
});
```

- Rows are added, never edited, except by Settings → Privacy, which takes a person out on
  request and deletes old rows under its retention rule (90 days unless changed). Names and emails are copied in, so the log still reads after
  someone is removed.
- Passwords, codes and tokens are never logged. A failed sign-in records the email typed.
- The CSV export quotes every value and defuses values a spreadsheet would run as formulas.

## Endpoints

| Method and path            | Permission      | Success                                   |
| -------------------------- | --------------- | ----------------------------------------- |
| `GET /security-log`        | `security:read` | 200 `{ events, page, perPage, total }`    |
| `GET /security-log/export` | `security:read` | 200 `text/csv` (up to 10,000 newest rows) |

Both accept `?kind=` (for example `sign-in-failed`); the list also takes `page` and `perPage`.

## Files

| File                         | What it does                                |
| ---------------------------- | ------------------------------------------- |
| `security-events.table.ts`   | The `security_events` table and event kinds |
| `security-log.schema.ts`     | Query and response schemas                  |
| `security-log.service.ts`    | Record, list and export                     |
| `security-log.repository.ts` | Database reads and writes                   |
| `security-log.routes.ts`     | The two endpoints                           |
