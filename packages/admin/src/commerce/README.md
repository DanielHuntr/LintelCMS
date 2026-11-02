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
  location, status, search-engine fields, and which hand-picked collections it's in (saved
  with the product, `ProductCollectionsCard.tsx`).
- **Collections** (`/commerce/collections`) lists product collections and how each picks its
  products. The editor sets the title, description and, for hand-picked ones, the products;
  automatic (rule-based) ones, such as those the Shopify import makes, keep their rules.
- **Orders** lists orders by "To send", "Sent" and "Refunded", and "Imported" (orders from
  before a move from Shopify, each leading to its customer) when there are any. An order shows its items,
  totals, customer, parcels and timeline, with dialogs to mark items as sent (with
  tracking), refund by items or by amount through Stripe, cancel, and add notes.
- **Customers** lists everyone who has ordered; a customer shows their orders (including
  those from before a move from Shopify), spend, addresses and a private note.
- **Discounts** lists codes and automatic offers, each summed up in a sentence ("20% off
  Summer Edit, orders of £50 or more, until 31 Aug", `discountSummary.ts`). The editor sets
  how shoppers get it, what it gives (percentage, amount per currency, free delivery, buy X
  get Y), what it's for, minimums, dates, limits and whether it combines, with the summary
  kept up to date as the form changes.
- **Move from Shopify** (`/commerce/import/shopify`) takes Shopify's CSV exports: choose the
  files, check the preview, the column mapping and the choices, try a dry run, import (in
  short batches, with progress; closing the page pauses it), then read the report with its
  redirects. Archived orders show on each customer.
- **Settings** holds Markets, Delivery, Tax, Payments and Order emails. Payments says which
  provider each market pays with, then has a guided "Connect" for each: Stripe's four
  numbered steps with links into the right Stripe pages, the webhook address to copy, and a
  check that the keys work; PayPal's (app, webhook, details) and Mollie's (account, API
  key). Keys set on the server are shown as such and can't be changed here.
- **The dashboard's Sales card** (`SalesCard.tsx`) shows the last 30 days' sales and the
  orders waiting to be sent, from `GET /shop/sales/summary`.

`commerceRoutes.tsx` is the one place the section joins the admin: `router.tsx` spreads it
under the signed-in route. The words are in `src/i18n/commerceStrings.ts`, and for
discounts, payment providers and the importer in `discountStrings.ts`,
`paymentProviderStrings.ts` and `shopifyImportStrings.ts` here, all spread into `strings.ts`.

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
| `ConnectPayPalSteps.tsx`, `ConnectMollieSteps.tsx`     | Connecting PayPal and Mollie                       |
| `ConnectStep.tsx`, `MarketPaymentProviders.tsx`        | A numbered step; which provider each market uses   |
| `DiscountsPage.tsx`, `DiscountEditorPage.tsx`          | Discounts and one discount                         |
| `Discount*Section.tsx`, `AmountsByCurrencyFields.tsx`  | The discount editor's sections                     |
| `discountDraft.ts`, `discountSummary.ts`               | The editor's form state; a discount in a sentence  |
| `ShopifyImportPage.tsx`, `Import*Step.tsx`             | Moving from Shopify, step by step                  |
| `ImportReportView.tsx`, `importReport.ts`              | The import's report and redirects                  |
| `ArchivedOrders.tsx`                                   | A customer's orders from before the move           |
| `EmailOutboxPage.tsx`                                  | Order emails kept while no email service is set up |
| `SalesCard.tsx`                                        | The dashboard's Sales card                         |
| `money.ts`, `currencies.ts`, `CountryPicker.tsx`       | Showing and reading money; currencies; countries   |
| `*.api.ts`, `*.queries.ts`                             | Calls to the API, and their caching                |
