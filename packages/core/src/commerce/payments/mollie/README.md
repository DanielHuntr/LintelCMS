# Mollie

Mollie's payments API with its hosted checkout, which offers cards, iDEAL, Bancontact and
the rest of the methods switched on in the Mollie dashboard.

Mollie's webhook carries only a payment id and no signature, so it proves nothing by
itself: `mollie-webhook.service.ts` fetches the payment back from Mollie with the shop's
API key and acts on what Mollie answers (authorized: the money is taken, if the checkout is
still open; paid: the order is placed once; expired, cancelled or failed: the stock goes
back). Refund statuses are brought up to date on the same call.

Every payment carries `lines` and both addresses, which Klarna, in3, Billie and vouchers
need. The shop only asks for a delivery address, so it's the billing address too. A bank
transfer takes days, so it's left open when its checkout closes, and honoured if it arrives.
Riverty and Billink need payments made with `captureMode: manual`, which Lintel doesn't do.

While the API runs on a local address, Mollie can't reach it, so payments are made without a
webhook address and Lintel asks Mollie itself (see `../README.md`).

| File                 | What it does                             |
| -------------------- | ---------------------------------------- |
| `mollie-client.ts`   | JSON requests with the API key           |
| `mollie-api.ts`      | Payments, refunds and the methods check  |
| `mollie-provider.ts` | The PaymentProvider, and finding the key |
| `mollie-webhook.*`   | `POST /shop/mollie/webhook`              |
