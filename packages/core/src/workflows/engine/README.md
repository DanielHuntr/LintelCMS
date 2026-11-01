# Workflow engine

Starting runs and carrying them through their steps. See the workflows README for the
rules; this is where they live.

| File                                       | What it does                                                                |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| `workflow-engine.ts`                       | `server.workflows`: claims due runs, in the background or by the minute job |
| `run-executor.ts`                          | One pass over a run: skip done steps, do the next, pause or finish          |
| `step-actions.ts`                          | What each action step does                                                  |
| `http-action.ts`                           | The HTTP step: signing, address check, keeping the answer                   |
| `conditions.ts`                            | Checking conditions, and describing them for the log                        |
| `templates.ts`                             | Safe `{{path}}` templates for text, URLs, headers and JSON                  |
| `run-context.ts`                           | What a run knows, built from an event or sample data                        |
| `recipients.ts`                            | Who "a role", "the person" or "these addresses" means                       |
| `start-runs.ts`                            | Writing a new run, with idempotency and the depth limit                     |
| `workflow-triggers.ts`                     | Starting runs for events and schedules                                      |
| `workflow-runs.service.ts`                 | Runs by hand, history and stopping                                          |
| `workflow-runs.repository.ts`              | Database reads and writes for runs and logs                                 |
| `cron.ts`, `retries.ts`                    | Schedules, and when to try again                                            |
| `action-result.ts`, `workflow-services.ts` | Shared types                                                                |
