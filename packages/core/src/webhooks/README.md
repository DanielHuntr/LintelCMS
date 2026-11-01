# Webhooks

Addresses Lintel tells when something happens, such as a static site builder that rebuilds
when a page is published. Admins add them in Settings → Webhooks.

Installed apps (`src/apps`) subscribe to events too. Their webhooks have `app_id` set, are
signed with the app's client secret, and aren't listed, changed or deleted here: they are
shown with the app and go when it is uninstalled.

## Events

`entry.published`, `entry.unpublished`, `entry.deleted`, `asset.uploaded` and
`asset.deleted` (the list is in `webhook-events.ts`). They come from `src/content-events`;
a scheduled entry going live is an `entry.published` like any other.

## What is sent

A `POST` with a JSON body:

```json
{
  "id": "delivery id",
  "event": "entry.published",
  "occurredAt": "2026-11-01T09:00:00.000Z",
  "data": {
    "entry": {
      "id": "...",
      "collection": "pages",
      "slug": "about",
      "title": "About",
      "url": "/about",
      "status": "published",
      "publishedAt": "..."
    }
  }
}
```

Asset events carry `data.asset = { id, filename, mimeType, url }`. Headers:
`Lintel-Event`, `Lintel-Delivery` (the delivery id, the same on every retry) and
`Lintel-Signature`.

## Checking the signature

`Lintel-Signature: t=<seconds>,v1=<hex>`, where `v1` is the HMAC-SHA256 of `"<t>.<raw body>"`
with the webhook's secret (shown on its page in the admin). Compare in constant time and
refuse a `t` more than five minutes old. In Node:

```js
const [t, v1 = ""] = header.split(",").map((part) => part.split("=")[1]);
const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex"));
const received = Buffer.from(v1);
const valid =
  received.length === expected.length &&
  timingSafeEqual(expected, received) &&
  Math.abs(Date.now() / 1000 - Number(t)) < 300;
```

`verifyWebhookSignature` in `webhook-signatures.ts` is the same check, used by the tests.

## Delivery, retries and the log

An event is first written down as one `webhook_deliveries` row per webhook that wants it,
then sent straight away in the background (`WebhookDispatcher.deliverSoon`). Any 2xx
answer counts as delivered. Anything else, a timeout (10 seconds) or a connection error is
tried again after 1 minute, 5, 30, 2 hours and 12 hours; after six attempts it is `failed`.
The scheduler (`src/scheduler`) sends whatever is due every minute, so retries survive a
restart. Each attempt claims its row in one update first, so several servers can share
the work without sending twice. Redirects are not followed.

The log keeps every delivery with its payload, the attempts, the status code and the
start of the answer. "Resend" makes a new delivery with the same data.

## Private addresses (SSRF)

Webhooks can't be sent to loopback, private, link-local (including cloud metadata at
169.254.169.254), carrier-grade NAT, multicast or reserved addresses, in IPv4 or IPv6,
however they are written. Obvious ones (`localhost`, `10.0.0.5`) are refused when the
webhook is saved; names are checked against the address they resolve to at the moment of
connecting, so DNS can't be switched afterwards. Set
`WEBHOOKS_ALLOW_PRIVATE_ADDRESSES=true` to test a receiver on your own machine.

## Endpoints

All need `settings:read` to look and `settings:update` to change.

| Method and path                                    | Body                                 | Success                       |
| -------------------------------------------------- | ------------------------------------ | ----------------------------- |
| `GET /webhooks`                                    | none                                 | 200 `{ webhooks: [Webhook] }` |
| `POST /webhooks`                                   | `{ name?, url, events, enabled? }`   | 201 `Webhook`                 |
| `GET /webhooks/:id`                                | none                                 | 200 `Webhook`                 |
| `PATCH /webhooks/:id`                              | `{ name?, url?, events?, enabled? }` | 200 `Webhook`                 |
| `DELETE /webhooks/:id`                             | none                                 | 204                           |
| `GET /webhooks/:id/deliveries`                     | `?page&perPage`                      | 200 `{ deliveries, total }`   |
| `POST /webhooks/:id/deliveries/:deliveryId/resend` | none                                 | 202 the new delivery          |

## Files

| File                                                         | What it does                                   |
| ------------------------------------------------------------ | ---------------------------------------------- |
| `webhooks.table.ts`                                          | The `webhooks` and `webhook_deliveries` tables |
| `webhooks.schema.ts`                                         | Zod schemas for requests and responses         |
| `webhooks.routes.ts`                                         | The endpoints                                  |
| `webhooks.service.ts`                                        | Adding, changing and removing webhooks         |
| `webhook-deliveries.service.ts`                              | Queueing, sending, retrying and resending      |
| `webhooks.repository.ts`, `webhook-deliveries.repository.ts` | Database reads and writes                      |
| `webhook-dispatcher.ts`                                      | Sending in the background; `server.webhooks`   |
| `webhook-sender.ts`                                          | One HTTP request, with the address check       |
| `address-safety.ts`                                          | Which addresses count as private               |
| `webhook-signatures.ts`                                      | Secrets, signing and checking                  |
| `webhook-retries.ts`                                         | When to try again                              |
| `webhook-events.ts`                                          | The list of events                             |
