# Health

Two addresses for hosting platforms, both at the root even when the API is under `/api`:

- `GET /health`: `200 { status: "ok" }` while the process runs. It touches nothing else,
  so a slow database never makes the server look dead and get restarted. Use it for
  uptime checks and Docker's `HEALTHCHECK`.
- `GET /ready`: `200 { status: "ready", checks }` when the server can do its job, `503
{ status: "not ready", checks }` otherwise, and while it shuts down. Use it for load
  balancers and zero-downtime deploys.

`checks` has `database`, `migrations` and `storage`, each `"ok"` or `"failing"`. The
reasons are logged (`Not ready to serve requests`), never sent, so they can't leak details.

- **database**: `select 1` answers.
- **migrations**: the newest migration in `migrations/meta/_journal.json` has been applied.
  Drizzle records each in `drizzle.__drizzle_migrations` with the journal's `when`.
- **storage**: the driver's `checkReachable()`: the uploads folder is writable, or the
  bucket exists and the keys may use it.

| File                   | What it does             |
| ---------------------- | ------------------------ |
| `health.routes.ts`     | The two routes           |
| `readiness.service.ts` | Running the checks       |
| `health.repository.ts` | The two database queries |
