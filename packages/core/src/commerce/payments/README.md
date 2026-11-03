# Payments

Who takes the money, behind one `PaymentProvider` interface (`payment-provider.ts`):
Stripe (the default), PayPal and Mollie. Each market says which one its shoppers pay with
(`paymentProvider` on the market; none means Stripe).

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

| File                                | What it does                                          |
| ----------------------------------- | ----------------------------------------------------- |
| `payment-provider.ts`               | The interface, provider names, the market's choice    |
| `payment-providers.ts`              | Every provider in one list                            |
| `payment-follow-up.ts`              | Emails and tax recording after a webhook commits      |
| `provider-amounts.ts`               | Minor units to "45.00" and back, without floats       |
| `provider-credentials.ts`           | PayPal and Mollie keys: the environment, then admin   |
| `payment-accounts.*`                | Saved PayPal and Mollie keys, PayPal's handled events |
| `payment-providers.*`               | Connecting PayPal and Mollie in the admin             |
| `stripe-*.ts`, `payment-settings.*` | Stripe: client, keys, "Connect Stripe", the webhook   |
| `ways-to-pay.*`                     | What each connected provider says shoppers can use    |
| `paypal/`                           | PayPal Orders v2: client, calls, provider, webhook    |
| `mollie/`                           | Mollie payments: client, calls, provider, webhook     |

## Ways to pay

Lintel never chooses payment methods. Stripe offers what's on in the account's default
Payment Method Configuration (no `payment_method_types` is sent, on either kind of payment),
and Mollie's page offers what's on for the key's website profile. Klarna, Clearpay, iDEAL and
the rest appear once the owner switches them on, and Stripe or Mollie approves them.

`GET /shop/settings/ways-to-pay` reads that back for the admin, and only ever reads:

| Provider | Read from                                                                           |
| -------- | ----------------------------------------------------------------------------------- |
| Stripe   | `GET /v1/payment_method_configurations`, the one with `is_default`                  |
| Mollie   | `GET /v2/methods`, once per currency, because by default it lists euro methods only |
| PayPal   | Nothing: it has no such call, so `methods` is null                                  |

`methods` is also null when a provider doesn't answer; the admin says so instead of guessing.
Neither list knows the shopper, so a method listed here can still be hidden from one shopper
by their country, the currency or the amount.

What redirecting and buy-now-pay-later methods need from the shop:

| Need                       | Stripe                                                     | Mollie                                                     |
| -------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------- |
| Coming back                | `success_url`; the storefront's `return_url` if embedded   | `redirectUrl`                                              |
| Email                      | `customer_email` or `receipt_email`                        | `billingAddress.email`                                     |
| Delivery address           | `payment_intent_data.shipping` or `shipping`               | `shippingAddress`, and `billingAddress` (the shop has one) |
| What was bought            | Line items when hosted; the PaymentIntent only has a total | `lines`, adding up to the payment exactly                  |
| Approved but not yet money | Nothing to do: Stripe says when it's paid                  | `authorized` is captured while the checkout is open        |
| Money that arrives days on | `…async_payment_succeeded` places the order                | A bank transfer is left open when its checkout closes      |

PayPal's page is reached with Orders v2 and a redirect. Lintel has no PayPal JavaScript, so no
Pay Later button or messaging; whether PayPal offers it on its own page isn't known, so the
admin doesn't claim it.

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
| `refund.created`, `refund.updated`                       | refunds settle, or are recorded   |

A payment whose amount or currency doesn't match the checkout is never turned into an order,
whoever took it: the checkout becomes `needs_review`.

## Configuration

| Variable                                   | What                                       |
| ------------------------------------------ | ------------------------------------------ |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | The PayPal REST app's credentials          |
| `PAYPAL_WEBHOOK_ID`                        | The webhook's id, for verifying its events |
| `PAYPAL_ENVIRONMENT`                       | `sandbox` (the default) or `live`          |
| `MOLLIE_API_KEY`                           | `test_…` while testing                     |

Set in the environment, they win over keys saved in the admin, as Stripe's do.
