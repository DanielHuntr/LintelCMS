# Test checkout

"Try your shop": someone who runs the shop places a real order on the website with no
payment account and no money, on a computer with no public address.

The admin's button calls `POST /shop/test-session` (`commerce:update`) and opens the link it
answers with. The website swaps the link's five-minute token for a two-hour HttpOnly cookie,
and from then on that one browser is a test shopper. Nothing is stored and there is no
switch for the whole site: a browser without a good token is an ordinary visitor, and can't
reach the test payment. Tokens are signed with a key derived from the install's signing
secret (`test-session-tokens.ts`).

In a test session:

- pages are drawn fresh with the banner, never kept in the page cache, and don't count in
  Visitors or A/B tests;
- products can be bought even while the shop shows "Coming soon" to everyone else;
- checkout uses the `test` provider, which a market can't choose. A bad or expired token at
  checkout is refused rather than treated as an ordinary shopper, so nobody who thinks they're
  testing reaches a real payment page by accident;
- the test payment page has two outcomes. Paying goes through `placeOrderForPayment` and the
  usual follow-up, so stock, emails, discounts and tax really happen. Failing releases the
  stock, as a failed payment does.

Orders paid with a provider's test keys get `isTest` too, when the provider says the payment
wasn't live: Stripe's `livemode: false` (nothing said means live, so a real sale is never
hidden), a Mollie payment in `mode: "test"`, or PayPal's sandbox. Their refunds still go to the
provider, and their tax is still recorded in Stripe's test data.

Test orders have `isTest`. They show a Test badge, their emails say they're a test, and
they're left out of sales figures, the dashboard and customers' totals. They publish no
events, so Visitors' goals and automations never see them, and their tax isn't reported to
Stripe from the test checkout. `DELETE /shop/test-orders` clears them all away: stock goes back unless a refund or
cancelling already put it back, discount uses are given back, and customers and order
numbers that only a test used go too. Each order's checkout goes with it, so a late message
from a provider finds nothing to pay.

| File                           | What it does                                       |
| ------------------------------ | -------------------------------------------------- |
| `test-session-tokens.ts`       | Signing and checking the two kinds of token        |
| `test-session.service.ts`      | Starting, opening and checking a session           |
| `test-payment-provider.ts`     | The `test` provider behind `PaymentProvider`       |
| `test-payments.service.ts`     | What the payment page's two buttons do             |
| `test-orders.*`                | Counting and deleting test orders                  |
| `test-checkout.routes.ts`      | The admin's routes                                 |
| `test-checkout-site.routes.ts` | The website's routes, and a test session's pages   |
| `test-checkout-pages.ts`       | The payment page, the refused pages and the banner |

It needs Lintel's built-in website, because the cookie lives there. A site built separately
can't start a test session.
