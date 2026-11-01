# Content events

Things that happen to content which other features react to: an entry published,
unpublished, deleted or moved to a new address, and a file uploaded or deleted.

Routes (and the scheduler, for scheduled publishing) call `announceContentEvent` after the
change is saved. `content-events.ts` is the one visible list of who listens:

- `src/webhooks` queues a delivery for every webhook that wants the event;
- `src/seo` suggests a redirect when a live entry moves (`entry.moved`);
- `src/website` empties the built-in website's rendered pages, so the change shows at once.

A listener failing is logged, not turned into an error for the person who made the
change, since the change itself has already been saved.

| File                  | What it does                             |
| --------------------- | ---------------------------------------- |
| `content-events.ts`   | The events and the list of listeners     |
| `entry-event-data.ts` | What events say about an entry or a file |
