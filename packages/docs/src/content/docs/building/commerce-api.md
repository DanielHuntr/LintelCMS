---
title: Commerce API
description: The storefront API under /delivery/shop, for product pages, carts and checkout.
since: "0.3"
---

The storefront API is how your website shows products and takes orders. It lives under
`/delivery/shop` and follows the same rules as the [delivery API](/building/delivery-api/):
no key or session, and browsers may call it from the sites listed under **Settings → API
access**. It only answers while the **Online shop** plugin is switched on; otherwise every
endpoint returns `404` with the code `PLUGIN_NOT_ENABLED`.

## Money

Every amount is an object with an integer in the currency's **smallest unit** and the
currency beside it. `{ "amount": 4500, "currency": "GBP" }` is £45.00;
`{ "amount": 4500, "currency": "JPY" }` is ¥4,500. Format it with `Intl.NumberFormat`:

```ts
function formatMoney({ amount, currency }: { amount: number; currency: string }) {
  const format = new Intl.NumberFormat("en-GB", { style: "currency", currency });
  const places = format.resolvedOptions().maximumFractionDigits ?? 2;
  return format.format(amount / 10 ** places);
}
```

## Markets

Prices depend on where the shopper is. Pass `?country=GB` (an ISO country code) to every
catalogue request to get that country's market, currency and prices; without it you get the
primary market.

Each market lists its `countries` and its `deliveryCountries`: the ones a shipping zone with
at least one rate covers. Offer `deliveryCountries` in a checkout's country picker, so
shoppers can only choose somewhere you deliver.

## Catalogue

| Request                                  | Query                                      | Response                                   |
| ---------------------------------------- | ------------------------------------------ | ------------------------------------------ |
| `GET /delivery/shop/markets`             | none                                       | `{ markets: Market[] }`                    |
| `GET /delivery/shop/products`            | `country`, `collection`, `page`, `perPage` | `{ items: Product[], total, currency }`    |
| `GET /delivery/shop/products/:handle`    | `country`                                  | `Product`, or 404                          |
| `GET /delivery/shop/collections`         | none                                       | `{ items: Collection[] }`                  |
| `GET /delivery/shop/collections/:handle` | `country`, `page`, `perPage`               | The collection with its `products`, or 404 |

Only products **on sale** are served. `perPage` is 24 by default, 100 at most.

```json
{
  "id": "6c1d…",
  "handle": "linen-shirt",
  "title": "Linen shirt",
  "descriptionHtml": "<p>Cool in summer.</p>",
  "images": [
    {
      "id": "…",
      "url": "/media/…",
      "alt": "A blue linen shirt",
      "width": 1600,
      "height": 2000,
      "focalPoint": null
    }
  ],
  "options": [{ "name": "Size", "values": ["S", "M", "L"] }],
  "priceRange": {
    "min": { "amount": 4500, "currency": "GBP" },
    "max": { "amount": 4500, "currency": "GBP" }
  },
  "availableForSale": true,
  "variants": [
    {
      "id": "a91f…",
      "title": "M",
      "optionValues": ["M"],
      "sku": "SHIRT-M",
      "price": { "amount": 4500, "currency": "GBP" },
      "compareAtPrice": null,
      "availableForSale": true,
      "weightGrams": 250
    }
  ]
}
```

## Carts

A cart is opened by its **token**: a long random string returned when the cart is made. Keep
it in a cookie or `localStorage`; anyone holding it can see and change the cart, so treat it
like a session id. Cart answers are never cached.

| Request                                          | Body                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------- |
| `POST /delivery/shop/carts`                      | `{ country? }`, answers `201 { token, cart }`                             |
| `GET /delivery/shop/carts/:token`                | none                                                                      |
| `PATCH /delivery/shop/carts/:token`              | `{ email?, country?, shippingAddress?, shippingRateId?, discountCodes? }` |
| `POST /delivery/shop/carts/:token/lines`         | `{ variantId, quantity? }`                                                |
| `PATCH /delivery/shop/carts/:token/lines/:id`    | `{ quantity }` (0 removes the line)                                       |
| `DELETE /delivery/shop/carts/:token/lines/:id`   | none                                                                      |
| `GET /delivery/shop/carts/:token/shipping-rates` | none, answers the rates for the cart's address                            |

Every change answers with the whole cart. Each line has a `problem` when it can't be bought
as it is (`unavailable`, `no_price`, `out_of_stock` or `not_enough_stock`, with
`quantityAvailable`), and the cart's `readyForCheckout` is `true` once every line can be
bought and the email, address and delivery rate are chosen.

### Discount codes

Send codes as `discountCodes` (one code per order; capital letters don't matter). A code that
can't be used at all (unknown, not started, expired, used up, already used by this email) is
refused with `400 DISCOUNT_CODE_INVALID` and a message to show by the code box, such as "This
code has expired.". A code that only needs a bigger order stays in the cart and is listed in
`discountProblems` with its message. The cart's `discounts` lists what each discount takes
off, with `code` empty for automatic discounts; a free-delivery discount has
`freeShipping: true` and is already taken off `shipping`.

```ts
const api = "https://cms.example.com";

const { token } = await fetch(`${api}/delivery/shop/carts`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ country: "GB" }),
}).then((response) => response.json());

await fetch(`${api}/delivery/shop/carts/${token}/lines`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ variantId, quantity: 1 }),
});
```

## Checkout

`POST /delivery/shop/carts/:token/checkout` fixes the prices, works out tax, holds the stock
(and one use of each discount), and starts the payment with the market's provider: Stripe,
PayPal or Mollie. It answers `201`:

```json
{
  "checkoutId": "0b5e…",
  "provider": "stripe",
  "mode": "hosted",
  "url": "https://checkout.stripe.com/c/pay/…",
  "clientSecret": null,
  "publishableKey": null,
  "expiresAt": "2026-11-01T12:30:00.000Z",
  "subtotal": { "amount": 9000, "currency": "GBP" },
  "shipping": { "amount": 400, "currency": "GBP" },
  "tax": { "amount": 1567, "currency": "GBP" },
  "total": { "amount": 9400, "currency": "GBP" },
  "taxesIncluded": true
}
```

- **Hosted** (the default): send `{ successUrl, cancelUrl }` with the request, then send the
  shopper to `url`. Stripe brings them back to `successUrl`.
- **Embedded** (chosen under **Settings → Payments**): give `clientSecret` and
  `publishableKey` to Stripe's
  [Payment Element](https://docs.stripe.com/payments/payment-element) on your own page.

With PayPal or Mollie the checkout is always hosted: send `{ successUrl, cancelUrl }` and
send the shopper to `url`, PayPal's or Mollie's own page.

Either way, card details go straight to the provider and never pass through your site or
Lintel.

The order is made **only** when the provider confirms the payment (Stripe's signed webhook,
a PayPal webhook PayPal has verified, or a payment fetched back from the provider with the
shop's own key, as happens when `GET /delivery/shop/checkouts/:id` is polled), never by
the shopper landing on your success page. On that page, poll
`GET /delivery/shop/checkouts/:checkoutId` until `status` is `completed`, then show
`orderName` ("#1001").

If the shopper doesn't pay before `expiresAt`, the stock goes back on sale. Starting the
checkout again from the same cart is fine: it replaces the earlier one.

## Errors

Errors use the same shape as the rest of the API, `{ statusCode, code, message }`, and the
`message` is written to be shown to shoppers.

| Status | Code                     | When                                                       |
| ------ | ------------------------ | ---------------------------------------------------------- |
| 404    | `CART_NOT_FOUND`         | The token doesn't match a cart (or the cart has expired)   |
| 400    | `DISCOUNT_CODE_INVALID`  | A code can't be used; 409 at checkout if it just ran out   |
| 400    | `CART_NOT_READY`         | Email, address or delivery rate missing, or a line problem |
| 409    | `OUT_OF_STOCK`           | Not enough stock, with `available`                         |
| 400    | `NOT_FOR_SALE`           | The variant isn't on sale in this market                   |
| 409    | `SHOP_NOT_READY`         | The market's payment provider isn't connected yet          |
| 502    | `PAYMENT_PROVIDER_ERROR` | The provider couldn't be reached; try again                |
| 404    | `PLUGIN_NOT_ENABLED`     | The Online shop plugin is off                              |

## Stripe's webhook

Stripe sends events to `POST /shop/stripe/webhook`. Lintel checks each event's signature with
the signing secret and records its id, so an event Stripe sends twice is only acted on once.
For local testing:

```bash
stripe listen --forward-to localhost:4000/shop/stripe/webhook
```

and use the signing secret it prints as `STRIPE_WEBHOOK_SECRET`.
