# Notifications

Messages for one person in the admin, shown under the bell beside Help: review requests,
"your page was approved", and anything a **Notify people** step sends. Each can link to
what it is about. People only ever see and mark their own.

| File                          | What it does                      |
| ----------------------------- | --------------------------------- |
| `notifications.service.ts`    | Sending, listing and marking read |
| `notifications.routes.ts`     | The endpoints                     |
| `notifications.repository.ts` | Database reads and writes         |
