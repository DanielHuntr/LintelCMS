# Shop testing helpers

- `fake-stripe.ts`: a `fetch` that answers the shop's Stripe calls from memory and records
  every request, plus `signedStripeWebhook` to send webhooks signed exactly as Stripe signs
  them. No network, no Stripe account.
- `fake-paypal.ts` and `fake-mollie.ts`: the same for PayPal (OAuth, Orders v2, captures,
  refunds, webhook verification) and Mollie (payments kept in memory, so a test can mark one
  paid and call the webhook with its id).
- `fake-shopify-cdn.ts`: product photos for the Shopify importer, served from memory.
- `test-shop.ts`: `startTestShop` (a server with the plugin on, every provider faked, a
  movable clock and an admin signed in), `stockTheShop` (a market, shipping and a product
  with stock) and `fillCart`.

`commerce.e2e.test.ts` uses them to run a sale from product to refund and fulfilment.
