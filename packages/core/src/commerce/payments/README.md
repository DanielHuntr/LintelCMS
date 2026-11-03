# Payments

Who takes the money, behind one `PaymentProvider` interface (`payment-provider.ts`):
Stripe (the default), PayPal and Mollie. Each market says which one its shoppers pay with
(`paymentProvider` on the market; none means Stripe). A fourth, `test`, takes no money and is
only used by a signed test session (see `../test-checkout`).

Shoppers always type their payment details into the provider's own page (Stripe Checkout,
PayPal, Mollie's hosted checkout) or Stripe's Payment Element (an iframe served by Stripe),
so card data never reaches Lintel and the shop stays within PCI SAQ A. Starting a payment
never marks anything paid: an order is placed only when the provider confirms it in a way
that can't be forged.

| Provider | How a payment is confirmed                                                        |
| -------- | --------------------------------------------------------------------------------- |
| Stripe   | `Stripe-Signature` on the webhook, an HMAC with the signing secret                |
| PayPal   | PayPal's own verify-webhook-signature API, for this shop's webhook id             |
| Mollie   | Mollie sends only an id; the payment is fetched back from Mollie with the API key |
| Any      | Fetched from the provider with the shop's key, when a webhook can't do it (below) |

| File                                | What it does                                          |
| ----------------------------------- | ----------------------------------------------------- |
| `payment-provider.ts`               | The interface, provider names, the market's choice    |
| `payment-providers.ts`              | Every provider in one list                            |
| `payment-follow-up.ts`              | Emails and tax recording after a payment commits      |
| `payment-confirmation.service.ts`   | Asking the provider when a shopper comes back         |
| `payment-checks.service.ts`         | Asking providers when no webhook can reach the shop   |
| `local-address.ts`                  | Whether a provider can reach the shop's address       |
| `provider-amounts.ts`               | Minor units to "45.00" and back, without floats       |
| `provider-credentials.ts`           | PayPal and Mollie keys: the environment, then admin   |
| `payment-accounts.*`                | Saved PayPal and Mollie keys, PayPal's handled events |
| `payment-providers.*`               | Connecting PayPal and Mollie in the admin             |
| `stripe-*.ts`, `payment-settings.*` | Stripe: client, keys, "Connect Stripe", the webhook   |
| `paypal/`                           | PayPal Orders v2: client, calls, provider, webhook    |
| `mollie/`                           | Mollie payments: client, calls, provider, webhook     |

## Stripe's webhook

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
| `checkout.session.async_payment_failed`                  | the same, for a delayed payment   |
| `refund.created`, `refund.updated`                       | refunds settle, or are recorded   |

A payment whose amount or currency doesn't match the checkout is never turned into an order,
whoever took it: the checkout becomes `needs_review`.

## When no webhook can reach the shop

Providers refuse a webhook address on someone's own computer, so Lintel also asks them itself,
with the shop's own key. Nothing needs setting up, and neither route can be forged, because
nothing from the shopper's browser is believed. Both end in `placeOrderForPayment`, under the
checkout's lock, so a return, a check and a webhook are safe in any order. See
`docs/decisions/0063`.

**When the shopper comes back** (`payment-confirmation.service.ts`). `GET
/delivery/shop/checkouts/:id` fetches the open checkout's payment, at most every three seconds.
Every shop does this; live shops keep the webhook because a shopper may not come back.

**Checks while nobody's there** (`payment-checks.service.ts`), for a local address or a provider
with no webhook set up. Every five seconds while there's an open checkout, a recent payment or
a pending refund; otherwise Stripe every five minutes and the others not at all. A failure
doubles the wait, up to five minutes.

| Provider | What is read                                                                         |
| -------- | ------------------------------------------------------------------------------------ |
| Stripe   | `GET /v1/events`, each passed through the webhook's handler and `shop_stripe_events` |
| PayPal   | Each open checkout's order (approved ones are captured), and pending refunds         |
| Mollie   | Each open payment, and payments with a pending refund                                |

Gaps: PayPal lists events only for a registered webhook, so a refund made in PayPal's dashboard
isn't seen, nor a payment that finishes after its checkout closed. Mollie has no event list,
and the same goes for a Mollie payment after its checkout closed.

`shop_settings.stripe_events_checked_until` keeps the place in Stripe's list, so a computer that
was asleep catches up. Each read overlaps the last by two minutes.

## Configuration

| Variable                                   | What                                       |
| ------------------------------------------ | ------------------------------------------ |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | The PayPal REST app's credentials          |
| `PAYPAL_WEBHOOK_ID`                        | The webhook's id, for verifying its events |
| `PAYPAL_ENVIRONMENT`                       | `sandbox` (the default) or `live`          |
| `MOLLIE_API_KEY`                           | `test_…` while testing                     |

Set in the environment, they win over keys saved in the admin, as Stripe's do.
