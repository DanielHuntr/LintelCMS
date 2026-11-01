# PayPal

PayPal through its Orders v2 API, with the shopper approving on PayPal's own page.

1. At checkout, `createPayPalOrder` makes an order with every line, shipping, tax and
   discount, `custom_id` set to the checkout's id, and PayPal's page as the address to send
   the shopper to.
2. `CHECKOUT.ORDER.APPROVED` arrives: if the checkout is still open, the order is captured
   (with a `PayPal-Request-Id`, so repeats are safe). A late approval is never charged.
3. `PAYMENT.CAPTURE.COMPLETED` arrives: the order is placed, once, if the amount matches.

Every webhook is confirmed with PayPal's verify-webhook-signature API (using the webhook
id saved with the credentials) before it's read. Refunds go against the capture.

| File                 | What it does                                     |
| -------------------- | ------------------------------------------------ |
| `paypal-client.ts`   | OAuth token and JSON requests                    |
| `paypal-api.ts`      | Orders, captures, refunds, webhook verification  |
| `paypal-provider.ts` | The PaymentProvider, and finding the credentials |
| `paypal-webhook.*`   | `POST /shop/paypal/webhook`                      |
