# Scheduler

Jobs the server runs on a timer, each on startup and then every minute:

- publishing scheduled entries that are due (`publishDueEntries`, in `src/entries`), and
  announcing them like any other publish (see `src/content-events`);
- sending webhook deliveries that are due: retries, and anything queued while no server
  was sending (`server.webhooks.deliverDue`, in `src/webhooks`).

`scheduled-jobs.ts` is the one visible list of jobs. `buildServer` registers it unless
`runScheduledJobs: false` is passed (tests do, so they decide when jobs run). Jobs start
when the server is ready and stop when it closes; closing waits for a run in progress.

`repeating-job.ts` is deliberately small: a timer that runs a task now and every so often,
skips a tick while the last run is still going, and reports failures without stopping.

## Several servers, and queues later

Every server process runs the jobs. That is safe because each job is: a scheduled entry is
claimed and published in a single update, so only one server publishes it. When Lintel
gets a job queue, replace `startRepeatingJob` in `scheduled-jobs.ts` with a repeating
queue job that calls the same task; the tasks themselves don't change.

| File                | What it does                                          |
| ------------------- | ----------------------------------------------------- |
| `scheduled-jobs.ts` | The list of jobs, started and stopped with the server |
| `repeating-job.ts`  | Running a task now and on an interval                 |
