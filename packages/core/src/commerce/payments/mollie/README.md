# Mollie

Mollie's payments API with its hosted checkout, which offers cards, iDEAL, Bancontact and
the rest of the methods switched on in the Mollie dashboard.

Mollie's webhook carries only a payment id and no signature, so it proves nothing by
itself: `mollie-webhook.service.ts` fetches the payment back from Mollie with the shop's
API key and acts on what Mollie answers (paid: the order is placed once; expired, cancelled
or failed: the stock goes back). Refund statuses are brought up to date on the same call.

While the API runs on localhost, Mollie can't reach it, so payments are made without a
webhook address; use a tunnel (or a public address in `API_PUBLIC_URL`) to test webhooks.

| File                 | What it does                             |
| -------------------- | ---------------------------------------- |
| `mollie-client.ts`   | JSON requests with the API key           |
| `mollie-api.ts`      | Payments, refunds and the methods check  |
| `mollie-provider.ts` | The PaymentProvider, and finding the key |
| `mollie-webhook.*`   | `POST /shop/mollie/webhook`              |
