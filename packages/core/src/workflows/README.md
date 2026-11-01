# Workflows (Automations)

Workflows let people automate routine work without code, and let developers run their own
code, in any language, when something happens in Lintel. In the admin they are called
**Automations**. They belong to the `automations` plugin: while it is off, nothing starts.

A workflow is one **trigger** and a list of **steps** (`workflow-definition.schema.ts`):

- Triggers: an event from the bus (`src/events`), optionally only for some collections; a
  five-field cron schedule in UTC; or a person pressing **Run now**.
- Actions: send an email, call a web address (HTTP with method, headers, a JSON body
  template and an HMAC signature), change an entry's field, publish or unpublish it,
  notify people in the admin, wait, run another workflow.
- Branching: **conditions** (a field equals, contains or changed; the collection is; the
  person has a role; any template value equals) and **approvals**, which pause until
  someone with the chosen role approves or asks for changes. Each has a `then` and an
  `otherwise` list of steps.

## Runs are durable

Starting a workflow writes a `workflow_runs` row with the steps copied in, so editing a
workflow never changes a run under way. The engine (`engine/`) claims due runs with a
lease, so several servers can share the work and a run picks up if its server stops.

- Each pass starts from the first step and skips steps already done (`stepStates`), so a
  finished step is never repeated. Progress is saved after every step, and every step
  writes a line to `workflow_step_logs`.
- Waits, approvals and retries pause the run (`waiting`, with `nextRunAt`); the minute job
  carries them on.
- A failed action is tried again after 30 seconds, 2, 10 and 60 minutes, then the run
  fails. Server errors, 429s, timeouts and connection errors are retried; anything a retry
  can't fix (a 404, a private address, a missing field) fails straight away.
- **Idempotency**: runs started by an event are keyed by the event's id, scheduled runs by
  their minute, and manual runs by an optional key, so nothing starts twice. HTTP calls
  carry `Idempotency-Key: <run id>:<step id>`, the same on every retry.
- **Timeouts**: HTTP steps give up after their own timeout (1 to 30 seconds), any step
  after 60 seconds, and approvals after their optional number of days.
- **Loops**: runs started by runs (child workflows, or events caused by a workflow) are one
  level deeper each time and stop at five.

## Templates

`{{entry.title}}`, `{{actor.email}}`, `{{steps.callServer.body.ticket}}`: dotted paths into
the run's context (see `engine/run-context.ts`), nothing more. No expressions, no code,
and only the context's own properties (`engine/templates.ts`). Bodies are parsed as JSON
before values go in, so values can't break the JSON; URLs are encoded and header values
lose line breaks.

## Calling your own code

`engine/http-action.ts`. The request goes through the webhooks' address check
(`src/webhooks/address-safety.ts`), so it can't reach the server's own network, and is
signed exactly like a webhook: `Lintel-Signature: t=<seconds>,v1=<hex HMAC-SHA256 of
"<t>.<body>">` with the workflow's secret. Other headers: `Lintel-Workflow`, `Lintel-Run`,
`Idempotency-Key` and, in test runs, `Lintel-Test: true`. A JSON answer is kept for later
steps. The developer docs (`building/workflows`) have verification code in four languages.

## Test runs

`POST /workflows/:id/run { test: true, sampleData }` runs with example data and changes
nothing: content steps describe what they would do, emails and notifications go only to
the tester, waits are skipped, approvals count as approved, HTTP calls are really sent.

## Content approval

`approvals/`: a collection can require approval before publishing. Switching it on makes a
workflow for that collection (purpose `content_approval`) started by
`entry.review_requested`: ask the reviewer role, then publish and tell the author, or tell
the author what to change. The `entry.publishing` check refuses to publish anything but the
approved version, except for people who may do everything.

## Endpoints

| Method and path                                                                      | Permission                            |
| ------------------------------------------------------------------------------------ | ------------------------------------- |
| `GET /workflows`, `GET /workflows/:id`                                               | `workflows:read`                      |
| `GET /workflows/catalogue`                                                           | `workflows:read`                      |
| `POST /workflows`, `PATCH`/`DELETE /workflows/:id`                                   | `workflows:update`                    |
| `POST /workflows/:id/run`                                                            | `workflows:update`                    |
| `GET /workflows/:id/runs`, `GET /workflow-runs/:runId`                               | `workflows:read`                      |
| `POST /workflow-runs/:runId/cancel`                                                  | `workflows:update`                    |
| `GET /workflow-approvals`, `POST /workflow-approvals/:id/decision`                   | signed in; the role to answer         |
| `GET /content-approval`, `PUT /content-approval/:handle`                             | `workflows:read` / `workflows:update` |
| `GET`/`POST /entries/:id/review`                                                     | `entries:read` / `entries:update`     |
| `GET /notifications`, `POST /notifications/:id/read`, `POST /notifications/read-all` | signed in                             |

## Files

| File                                                                     | What it does                                         |
| ------------------------------------------------------------------------ | ---------------------------------------------------- |
| `register-workflows.ts`                                                  | The one registration point, called from `server.ts`  |
| `workflow-definition.schema.ts`                                          | Triggers, steps and conditions                       |
| `workflows.schema.ts`                                                    | Requests and responses                               |
| `workflows.table.ts`                                                     | Workflows, runs, step logs, approvals, notifications |
| `workflows.routes.ts`, `workflows.service.ts`, `workflows.repository.ts` | Managing workflows                                   |
| `workflow-people.repository.ts`                                          | Who has a role, and which roles someone has          |
| `engine/`                                                                | Starting, running and logging runs                   |
| `approvals/`                                                             | Approval steps and content approval                  |
| `notifications/`                                                         | Messages for people in the admin                     |
