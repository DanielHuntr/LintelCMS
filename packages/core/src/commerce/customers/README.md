# Customers

A customer is made by their first order and found again by email (stored lowercase). Their
delivery addresses are remembered, newest first, up to ten. Staff can add a name, phone
number and private note. Totals spent are per currency and net of refunds.

Orders from before a move from Shopify (`shop_archived_orders`) count towards the order
count and total spent, like live orders (cancelled ones left out), and `customerSince` is the
earlier of the record's `createdAt` and their first such order.

Endpoints: `GET /shop/customers`, `GET /shop/customers/:id`, `PATCH /shop/customers/:id`.
A customer's orders come from `GET /shop/orders?customerId=`. `address.schema.ts` is the
postal address used by carts, checkouts and orders too.
