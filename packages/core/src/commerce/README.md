# Commerce

Lintel's online shop: a catalogue, markets and money, carts and checkout, discounts,
payments through Stripe, PayPal or Mollie, orders, refunds and shipping, and an importer
for shops moving from Shopify. It is the `commerce` plugin ("Online shop"): every
endpoint here answers `404 PLUGIN_NOT_ENABLED` until it is switched on (see `src/plugins`).

Everything about the shop lives in this folder, and it touches the rest of Lintel in these
places only:

| Where                             | What                                                                |
| --------------------------------- | ------------------------------------------------------------------- |
| `src/plugins/plugins.registry.ts` | `commercePlugin`, the plugin with its permissions and routes        |
| `src/server.ts`                   | `registerCommerce(server, options.commerce)`                        |
| `src/database/schema.ts`          | `export * from "../commerce/commerce.tables.js"`                    |
| `src/http/cross-origin.ts`        | carts may also be `PATCH`ed and `DELETE`d from listed sites         |
| `server.email`, `server.events`   | order emails, and `order.paid`, `order.fulfilled`, `order.refunded` |

`commerce.plugin.ts` registers every route below, in one visible list. `register-commerce.ts`
makes the shop's context, declares its events for Automations and starts the job that
releases stock from abandoned checkouts. `commerce.context.ts` is what services get besides
the database: Stripe, PayPal and Mollie, the email sender, the event bus, the discount
provider and the clock; the payment services, discounts and clock are replaceable through
`buildServer({ commerce: { ... } })` (tests replace all of them).

## How a sale flows

```text
storefront                    Lintel                                   Stripe
──────────                    ──────                                   ──────
POST /delivery/shop/carts ──▶ cart (anonymous token)
add lines, email, address ──▶ priced in the market for the country
POST …/checkout ────────────▶ freeze prices, tax (Stripe Tax), hold stock ─▶ Checkout Session
                                                                          or PaymentIntent
shopper pays on Stripe's page or Payment Element (card details never reach Lintel: SAQ A)
                              POST /shop/stripe/webhook ◀──────────── signed event
                              verify signature, record event id once,
                              checkout → order #1001, stock taken, email queued
admin: refund ──────────────▶ pending refund ─────────────────────────▶ POST /v1/refunds
admin: fulfil ──────────────▶ items sent, tracking, "on its way" email
```

PayPal and Mollie follow the same shape with their own hosted pages and webhooks (see
`payments/`); each market says which provider its shoppers pay with.

Orders are made **only** once the provider confirms the payment: its signed webhook, or the
payment fetched back from it with the shop's own key (see `payments/`). The success page a
shopper lands on proves nothing, so it never marks anything paid. The test checkout
(`test-checkout/`) places orders marked as test, for a signed test session only.

## Money

Every amount is an integer in the currency's smallest unit (`4500` is £45.00, `4500` yen is
¥4,500), with the currency beside it. See `money/`.

## Folders

| Folder                 | What it holds                                                        |
| ---------------------- | -------------------------------------------------------------------- |
| `money/`               | The Money type, currencies and countries from Intl, price conversion |
| `settings/`            | The shop's settings row and the Shop → Settings endpoints            |
| `markets/`             | Where the shop sells, in which currency, with what rounding          |
| `products/`            | Products, options, variants and prices                               |
| `product-collections/` | Groups of products, picked by hand or by rules                       |
| `inventory/`           | Locations, stock levels and reservations (no overselling)            |
| `shipping/`            | Zones and rates: flat, by weight, free over an amount                |
| `taxes/`               | The tax provider interface: Stripe Tax, or manual rates              |
| `discounts/`           | Codes and automatic discounts, their limits and arithmetic           |
| `carts/`               | The storefront's cart and its endpoints                              |
| `checkouts/`           | From cart to payment: totals, stock held, Stripe started             |
| `payments/`            | The PaymentProvider interface: Stripe, PayPal, Mollie, webhooks      |
| `orders/`              | Orders, refunds, fulfilments, the timeline                           |
| `customers/`           | Customers and their addresses                                        |
| `emails/`              | Order emails (through src/email) and the order events                |
| `storefront/`          | The public catalogue under /delivery/shop                            |
| `sales/`               | The numbers behind the dashboard's Sales card                        |
| `shopify-import/`      | Moving a shop from Shopify's CSV exports                             |
| `testing/`             | Fake Stripe, PayPal, Mollie and Shopify CDN, and a test shop         |

## Permissions

`commerce:read` to look, `commerce:update` to change the catalogue, settings and orders,
`commerce:refund` to refund or cancel (money leaves the business), and `settings:update`
as well to change the Stripe keys.

## Configuration

| Variable                 | What                                                            |
| ------------------------ | --------------------------------------------------------------- |
| `STRIPE_SECRET_KEY`      | `sk_test_…` while testing. Wins over a key pasted in the admin  |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_…`, handed to storefronts using the Payment Element    |
| `STRIPE_WEBHOOK_SECRET`  | `whsec_…`, the signing secret of the webhook endpoint in Stripe |

PayPal and Mollie keys (`PAYPAL_CLIENT_ID`, `MOLLIE_API_KEY`...) are listed in
`payments/README.md`.

For local testing, `stripe listen --forward-to localhost:4000/shop/stripe/webhook` prints a
signing secret to use.
