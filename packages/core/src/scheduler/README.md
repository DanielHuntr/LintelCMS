# Scheduler

Jobs the server runs on a timer, each on startup and then every minute:

- publishing scheduled entries that are due (`publishDueEntries`, in `src/entries`), and
  announcing them like any other publish (see `src/content-events`);
- sending webhook deliveries that are due: retries, and anything queued while no server
  was sending (`server.webhooks.deliverDue`, in `src/webhooks`).

Automations add one more job of their own in `registerWorkflows` (src/workflows): starting
scheduled workflows and carrying on waits, retries and new runs.

`scheduled-jobs.ts` is the one visible list of core's jobs. `buildServer` registers it unless
`runScheduledJobs: false` is passed (tests do, so they decide when jobs run). Jobs start
when the server is ready and stop when it closes; closing waits for a run in progress.

`repeating-job.ts` is deliberately small: a timer that runs a task now and every so often,
skips a tick while the last run is still going, and reports failures without stopping.

## Running the jobs from cron

Shared hosting pauses an app nobody is visiting, and its timers with it. So every job is
also listed in `server.scheduledJobs` (`scheduled-job-list.ts`): features call
`server.scheduledJobs.add(name, job)` when they start one, and
`POST /system/run-scheduled-jobs` runs them all once. A job already running is waited for
rather than started again (`job.runNow()`). The request has to carry the cron secret in
`X-Lintel-Cron-Secret`: `CRON_SECRET` when set, otherwise one Lintel makes and keeps in
`<data folder>/cron-secret.txt` (`cron-secret.repository.ts`), compared in constant time.
It is limited to 10 calls a minute. `lintel cron --print-line` prints the crontab line.

| Status | `code`                | When                     |
| ------ | --------------------- | ------------------------ |
| 401    | `CRON_SECRET_MISSING` | No secret header         |
| 403    | `CRON_SECRET_INVALID` | The secret isn't right   |
| 429    |                       | More than 10 in a minute |

## Several servers, and queues later

Every server process runs the jobs. That is safe because each job is: a scheduled entry is
claimed and published in a single update, so only one server publishes it. When Lintel
gets a job queue, replace `startRepeatingJob` in `scheduled-jobs.ts` with a repeating
queue job that calls the same task; the tasks themselves don't change.

| File                        | What it does                                           |
| --------------------------- | ------------------------------------------------------ |
| `scheduled-jobs.ts`         | The list of jobs, started and stopped with the server  |
| `repeating-job.ts`          | Running a task now and on an interval                  |
| `scheduled-job-list.ts`     | Every running job by name, to run them all on request  |
| `scheduler.routes.ts`       | `POST /system/run-scheduled-jobs`                      |
| `scheduler.service.ts`      | Finding and checking the cron secret, running the jobs |
| `cron-secret.repository.ts` | The secret Lintel makes, in the data folder            |
| `scheduler.config.ts`       | `CRON_SECRET`                                          |
