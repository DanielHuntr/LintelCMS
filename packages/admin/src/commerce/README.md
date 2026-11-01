# Shop

The Shop section (`/commerce`), shown in the sidebar only while the `commerce` plugin
("Online shop") is switched on. Everything here talks to the routes in
`packages/core/src/commerce`; how sales, payments and stock work is explained there.

- **Shop home** (`/commerce`) lists what's left to do before the first sale (choose where
  you sell, set delivery prices, connect Stripe, add a product), each linking to its screen,
  then the shop's sections.
- **Products** lists the catalogue with stock and price ranges. The editor has the name,
  description and photos, options (Size: S, M, L) that make the variants, a price per
  variant in the primary currency (other currencies are worked out unless set), stock per
  location, status, and search-engine fields.
- **Orders** lists orders by "To send", "Sent" and "Refunded". An order shows its items,
  totals, customer, parcels and timeline, with dialogs to mark items as sent (with
  tracking), refund by items or by amount through Stripe, cancel, and add notes.
- **Customers** lists everyone who has ordered; a customer shows their orders, spend,
  addresses and a private note.
- **Settings** holds Markets, Delivery, Tax, Payments and Order emails. Payments is the
  guided "Connect Stripe": four numbered steps with links into the right Stripe pages, the
  webhook address to copy, and a check that the keys work. Keys set on the server are
  shown as such and can't be changed here.
- **The dashboard's Sales card** (`SalesCard.tsx`) shows the last 30 days' sales and the
  orders waiting to be sent, from `GET /shop/sales/summary`.

`commerceRoutes.tsx` is the one place the section joins the admin: `router.tsx` spreads it
under the signed-in route. The words are in `src/i18n/commerceStrings.ts`.

| File                                                   | What it does                                       |
| ------------------------------------------------------ | -------------------------------------------------- |
| `commerceRoutes.tsx`                                   | Every Shop route                                   |
| `ShopHomePage.tsx`                                     | Getting ready to sell, and the sections            |
| `ProductsPage.tsx`, `ProductEditorPage.tsx`            | The catalogue and the product editor               |
| `Product*Section.tsx`, `VariantFields.tsx`             | The editor's sections                              |
| `productDraft.ts`                                      | The editor's form state and what it sends          |
| `OrdersPage.tsx`, `OrderDetailPage.tsx`                | Orders and one order                               |
| `FulfilDialog.tsx`, `RefundDialog.tsx`                 | Marking items as sent, refunding                   |
| `CancelOrderDialog.tsx`, `LineQuantityFields.tsx`      | Cancelling, and choosing quantities per line       |
| `OrderTimeline.tsx`, `OrderStatusBadge.tsx`            | An order's history and status                      |
| `CustomersPage.tsx`, `CustomerDetailPage.tsx`          | Customers and one customer                         |
| `ShopSettingsPage.tsx`                                 | The settings list                                  |
| `MarketsPage.tsx`, `MarketDialog.tsx`                  | Where you sell and in which currency               |
| `ShippingPage.tsx`, `ZoneDialog.tsx`, `RateDialog.tsx` | Delivery areas and prices                          |
| `TaxesPage.tsx`                                        | Stripe Tax or your own rates                       |
| `PaymentsPage.tsx`, `ConnectStripeSteps.tsx`           | Connecting Stripe                                  |
| `EmailOutboxPage.tsx`                                  | Order emails kept while no email service is set up |
| `SalesCard.tsx`                                        | The dashboard's Sales card                         |
| `money.ts`, `currencies.ts`, `CountryPicker.tsx`       | Showing and reading money; currencies; countries   |
| `*.api.ts`, `*.queries.ts`                             | Calls to the API, and their caching                |
