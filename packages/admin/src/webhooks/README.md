# Webhooks

Settings → Webhooks (`/settings/webhooks`): addresses Lintel tells when content changes.

- The list shows each webhook's address, how many events it sends and how its last
  delivery went. With none yet, an empty state explains what webhooks are for.
- "Add webhook" asks for the address, an optional name and the events, as switches in
  plain words ("An entry is published"). The API refuses private and local addresses and
  the message says why.
- A webhook's page (`/settings/webhooks/:id`) has a switch to pause it, the signing secret
  (hidden until "Show", with a copy button), and the delivery log. Each delivery opens to
  show what happened in words ("Didn't get through (2 tries). Trying again in 4 minutes."),
  the receiver's answer and the payload, with "Resend". The log refreshes on its own while
  anything is still being retried.

How sending, signing and retries work is in `packages/core/src/webhooks/README.md`.

| File                                     | What it does                          |
| ---------------------------------------- | ------------------------------------- |
| `WebhooksPage.tsx`                       | The list                              |
| `WebhookDetailPage.tsx`                  | One webhook: settings, secret and log |
| `WebhookFormDialog.tsx`                  | Adding and changing a webhook         |
| `DeliveryLog.tsx`                        | The delivery log, with resend         |
| `DeliveryStatusBadge.tsx`                | Delivered, Retrying or Failed         |
| `webhooks.api.ts`, `webhooks.queries.ts` | Calls to the API, and their caching   |
