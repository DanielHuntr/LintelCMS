# Shop testing helpers

- `fake-stripe.ts`: a `fetch` that answers the shop's Stripe calls from memory and records
  every request, plus `signedStripeWebhook` to send webhooks signed exactly as Stripe signs
  them. No network, no Stripe account.
- `test-shop.ts`: `startTestShop` (a server with the plugin on, Stripe faked, a movable
  clock and an admin signed in), `stockTheShop` (a market, shipping and a product with
  stock) and `fillCart`.

`commerce.e2e.test.ts` uses both to run a sale from product to refund and fulfilment.
