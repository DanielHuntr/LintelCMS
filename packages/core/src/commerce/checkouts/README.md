# Checkouts

A checkout is a cart frozen when the shopper goes to pay (`checkouts.service.ts`):

1. the cart must be ready (lines, email, address, shipping);
2. tax is worked out (Stripe Tax or manual rates);
3. in one transaction, any checkout the shopper started before is abandoned and its stock
   released, the new checkout is saved and its stock reserved (`inventory/`);
4. Stripe is asked for a hosted Checkout Session or a PaymentIntent (`stripe-payment.ts`),
   carrying `lintel_checkout_id` in its metadata.

Stock is held for 35 minutes (`CHECKOUT_WINDOW_MINUTES`; Stripe's pages last at least 30).
`checkout-expiry.ts` closes checkouts that run out, on Stripe's side too. A payment that
still arrives later is honoured, and the order says the stock may be short.

Statuses: `open`, `completed` (an order exists), `expired`, `needs_review` (Stripe reported
a payment that didn't match). When the site lists its addresses in Settings → API access,
the hosted page may only send shoppers back to those.
