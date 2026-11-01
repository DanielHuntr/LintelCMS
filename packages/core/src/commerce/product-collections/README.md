# Product collections

Groups of products shown together, such as "Summer sale". Named product collections in code
so they're never mixed up with the CMS's content collections.

- **Manual** collections hold the products picked, in order.
- **Automatic** ones hold every product matching their rules, all of them or any of them.
  Rules look at a tag, the title, vendor or product type (is / contains), or the price in
  the primary currency (is / more than / less than, in minor units). They become one SQL
  condition (`product-collection-rules.ts`), so matching happens in the database.

Endpoints: `GET/POST /shop/collections`, `GET/PUT/DELETE /shop/collections/:id`.
