# Command line

`lintel <command>`: commands for whoever runs a Lintel server. In the repository,
`pnpm lintel <command>`; in the hosting package, `node lintel.js <command>` or the
package.json scripts (cPanel's "Run JS script" button lists them).

| Command             | What it does                                                                        |
| ------------------- | ----------------------------------------------------------------------------------- |
| `cron`              | Asks the running Lintel to run its scheduled jobs (POST /system/run-scheduled-jobs) |
| `cron --print-line` | Prints the crontab line (curl with the secret) for the host's Cron Jobs screen      |
| `doctor`            | Checks the settings, the data folder and the built admin                            |
| `doctor --hosting`  | Adds the hosting checker's report (see `src/hosting`)                               |

Each returns exit code 0 when all is well and 1 when something needs doing, with a plain
message saying what. `cron` goes through the website rather than the database because
the built-in database can only be open in one process, and the request also wakes an app
the host has paused.

| File                 | What it does                                           |
| -------------------- | ------------------------------------------------------ |
| `lintel.ts`          | Reads the command and runs it                          |
| `cron-command.ts`    | `cron`, and the cron line                              |
| `doctor-command.ts`  | `doctor`                                               |
| `hosting-checker.ts` | Loads `lintel-check.cjs` and describes what it exports |

## check, publish and export

`lintel check` is `doctor --hosting`, which also connects to the Postgres database in
`DATABASE_URL` (see `src/server-check`). `lintel publish` and `lintel export` publish the website
as files (`publish-command.ts`, see `src/publishing` and `src/static-site`).
