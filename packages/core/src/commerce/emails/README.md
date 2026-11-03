# Order emails

Three emails, in plain text and simple HTML (`order-emails.ts`): **Order #1001 confirmed**
(with any discount codes used), **Order #1001 is on its way** (with tracking) and **Refund
for order #1001**. They go through `server.email` like every other email Lintel sends (see
`src/email`), so EMAIL_DRIVER decides whether they really leave the server; until it names a
mail service they wait in Users → Security log → Emails sent. Replies go to the shop's support address.

`order-notifications.ts` runs after the change is saved: `announceOrderPaid`,
`announceOrderFulfilled` and `announceOrderRefunded` send the customer's email (the last two
only when staff ask) and publish `order.paid`, `order.fulfilled` or `order.refunded` on the
event bus for automations (see `orders/order-events.ts`). An email failure is logged and
noted on the order's timeline, never undoing anything.
