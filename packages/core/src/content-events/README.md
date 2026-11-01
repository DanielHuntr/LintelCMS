# Content events

Things that happen to content: an entry created, changed, published, unpublished, deleted
or moved to a new address, and a file uploaded or deleted.

Routes (and the scheduler, for scheduled publishing) call `announceContentEvent` after the
change is saved, with who made it. It publishes the event on the bus in `src/events`, where
webhooks, SEO and automations listen (`src/events/event-listeners.ts` is the list).

| File                  | What it does                             |
| --------------------- | ---------------------------------------- |
| `content-events.ts`   | Announcing a content event on the bus    |
| `entry-event-data.ts` | What events say about an entry or a file |
