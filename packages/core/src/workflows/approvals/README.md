# Approvals and content approval

The approval step pauses a run until someone with a role answers. Content approval is the
editorial workflow built on it: a collection that requires approval gets a workflow
started by `entry.review_requested` (an event this folder declares on the bus).

1. The author presses **Submit for review** (`POST /entry-reviews/:id`).
2. The run asks the reviewer role; its members are notified (or the super admins, when the
   role has nobody).
3. A reviewer approves or asks for changes, with a comment, from the entry's side panel.
4. Approved: the entry is published (when "Publish as soon as it's approved" is on) and the
   author told. Changes requested: the author is told what to change.

Until it is approved, the `entry.publishing` check refuses to publish. An approval covers
the version submitted: saving different values afterwards needs another review.

| File                          | What it does                                     |
| ----------------------------- | ------------------------------------------------ |
| `approval-steps.ts`           | Asking, and reading the answer, inside a run     |
| `approvals.service.ts`        | Answering requests, and who may                  |
| `content-approval.service.ts` | Per-collection settings, review state, the check |
| `content-approval.steps.ts`   | The steps of a collection's approval workflow    |
| `review-events.ts`            | The `entry.review_requested` event               |
| `approvals.routes.ts`         | The endpoints                                    |
| `approvals.repository.ts`     | Database reads and writes                        |
