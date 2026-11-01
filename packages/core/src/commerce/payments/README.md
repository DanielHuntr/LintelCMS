# Payments

Stripe, and only Stripe, takes the money. Shoppers type card details into Stripe's hosted
Checkout page or its Payment Element (an iframe served by Stripe), so card data never
reaches Lintel and the shop stays within PCI SAQ A.

| File                        | What it does                                                    |
| --------------------------- | --------------------------------------------------------------- |
| `stripe-client.ts`          | A small typed client for Stripe's REST API (form-encoded)       |
| `stripe-api.ts`             | The calls the shop makes, each with the answer it relies on     |
| `stripe-keys.ts`            | Where keys come from: the environment first, then the admin     |
| `payment-settings.*`        | The "Connect Stripe" steps: save, check and forget keys         |
| `stripe-signature.ts`       | Checking `Stripe-Signature` (HMAC-SHA256, five-minute window)   |
| `stripe-webhook-events.ts`  | The events to subscribe to, and the parts of them that are read |
| `stripe-webhook.service.ts` | Handling each event once                                        |
| `stripe-events.table.ts`    | Event ids already handled                                       |

## The webhook

`POST /shop/stripe/webhook`. The raw body is checked against the signing secret before
anything else; a missing or wrong signature is a 400. The event id is then recorded in the
same transaction as the work, so a repeat is acknowledged and ignored, and a failure leaves
nothing behind for Stripe's retry to trip over. Emails and recording tax with Stripe happen
after the commit.

| Event                                                    | What happens                      |
| -------------------------------------------------------- | --------------------------------- |
| `checkout.session.completed`, `…async_payment_succeeded` | the order is placed (once)        |
| `payment_intent.succeeded`                               | the same, for the Payment Element |
| `checkout.session.expired`, `payment_intent.canceled`    | the checkout's stock is released  |
| `refund.created`, `refund.updated`                       | refunds settle, or are recorded   |

A payment whose amount or currency doesn't match the checkout is never turned into an order:
the checkout becomes `needs_review`.
