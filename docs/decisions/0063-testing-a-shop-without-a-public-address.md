# 63. Testing a shop without a public address

Date: 2026-11-03

## Context

Orders were only placed when a provider's webhook arrived, and providers refuse webhook
addresses on localhost. Someone setting up a site on their own computer could never get a
test order. Non-technical users won't install a command line tool or a tunnel.

## Decision

**A test checkout, per browser.** "Try your shop" opens the website with a signed five-minute
token, swapped for a signed two-hour HttpOnly cookie. Only a request with a good token gets the
`test` payment provider, so there is no site-wide switch that could leave a live shop taking
free orders. Markets can't choose `test`: `marketPaymentProviderIds` leaves it out. A bad token
at checkout is refused, not treated as an ordinary shopper, so a tester can't be sent to a real
payment page by accident.

**Test orders go through the real path.** They use `placeOrderForPayment`, so stock, emails,
discounts and tax are exercised. They're marked `isTest` and left out of sales, publish no
events (so no analytics goals and no automations), and report no tax to Stripe. Placement
refuses a test payment on a real checkout, and a real payment on a test one.

**Lintel asks the provider itself.** Two routes end in the same placement as the webhook:

- When a shopper comes back, `GET /delivery/shop/checkouts/:id` fetches the payment with the
  shop's own key, at most every three seconds per checkout.
- When no webhook can reach the shop (a local address, or none set up), a job reads Stripe's
  list of events and passes each through the webhook's handler with the same record of handled
  events. PayPal and Mollie have no such list for a shop like this, so each open checkout and
  pending refund is fetched.

Nothing from the shopper's browser is believed, so neither route can be forged, and the
webhook's signature check is unchanged. The checkout's row lock makes a return, a polled event
and a webhook safe in any order. The amount and currency check applies to all of them.

The job asks every five seconds while something is happening (an open checkout, a recent
payment, a pending refund). Otherwise it asks Stripe every five minutes, for refunds made in
its dashboard, and PayPal and Mollie not at all. It backs off when a provider fails. A public
shop with its webhook set up makes no calls.

A local shop counts as connected without a webhook, and the admin doesn't show a webhook step
that can only fail.

## Consequences

- Live shops keep the webhook as the normal route; a shopper may not come back.
- `GET` on a checkout's status can now place an order. That's safe to repeat, and every
  storefront already polls it.
- Test orders use order numbers. Deleting them hands the numbers back unless a real order has
  come after, in which case there's a gap.
- Orders paid with a provider's test keys are marked as test too, on the provider's word:
  Stripe's `livemode: false`, a Mollie payment in `mode: "test"`, or PayPal's sandbox. If
  Stripe says nothing the payment counts as live, so a real sale can't be hidden.
- Refunds made in PayPal's dashboard aren't seen without its webhook, because PayPal only
  lists events for a registered webhook.
