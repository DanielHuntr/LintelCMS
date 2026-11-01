# Orders

Orders are made by `order-placement.service.ts`, called only from the Stripe webhook, so
every order has been paid. Lines, prices and addresses are copied from the checkout, so
editing a product later never changes history. Numbers count up per shop (`#1001`), and
abandoned checkouts never use one.

Statuses follow from the numbers (`order-statuses.ts`): payment is paid, partially refunded
or refunded; fulfilment is unfulfilled, partially fulfilled or fulfilled; and an order can be
cancelled before anything is sent.

| File                     | What it does                                               |
| ------------------------ | ---------------------------------------------------------- |
| `orders.service.ts`      | Listing, one order with its timeline, notes, cancelling    |
| `refunds.service.ts`     | Refunds through Stripe; refunds made in Stripe's dashboard |
| `fulfilments.service.ts` | Sending items, with tracking                               |
| `order-totals.ts`        | Keeping refunded amounts and statuses true                 |
| `order-descriptions.ts`  | The shape the admin gets                                   |

A refund is saved as `pending` before Stripe is asked, so a double click can't refund
twice; Stripe's idempotency key guards the request too. Its items are restocked when it
succeeds, if asked.

Endpoints: `GET /shop/orders`, `GET /shop/orders/:id`, `POST /shop/orders/:id/fulfilments`,
`/refunds`, `/cancel` and `/notes` (see `orders.routes.ts`).
