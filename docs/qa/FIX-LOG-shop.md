# Lintel 1.0.0-rc.1: shop and data fix log

Fixing pass, 2 Nov 2026, branch `fix/qa-shop` from `qa/discovery`. Defect details are in [BUG-REPORT.md](BUG-REPORT.md).

**Environment:**

- Linux; Chromium headless (Playwright, one worker);
- dev servers: API :4740, site :3740, admin :5740; data folder `/tmp/fix-shop-data`;
- built-in database; shop enabled at setup;
- seeded like the discovery pass: market GB/GBP, zone UK with Standard £4.95 (2 to 3 working days), product `linen-shirt` (M £45, L £50, no picture), discount `SAVE10` (10% off everything).

Screenshots are in [screenshots/fix-shop/](screenshots/fix-shop/). "Before" screenshots were taken on the unfixed code in the same environment.

## LINTEL-DATA-001: Backups store media files as 0 bytes

**Status:** Verified.

**Root cause (confirmed):**

- `ZipArchiveWriter.addStream` counted bytes with a `'data'` listener on a `PassThrough`. A `'data'` listener switches the stream to flowing mode, so chunks were hashed and then dropped whenever they arrived before yazl piped the entry.
- It is a race, not a constant failure. yazl only pipes an entry once the entries before it are written, so whether it attaches before the first chunk depends on timing.
- On the unfixed code, 2 of 11 backups in this environment had 0-byte media (one with one image empty, one with both), and their restore preview answered `400 BACKUP_DAMAGED`. The existing test `backup archives > says what a restore would replace…` also failed with `BackupDamagedError` on the first run.
- `content-export.service.ts` calls the same `addStream`, so content exports with files had the same race.

**Change:**

- `packages/core/src/archives/zip-writer.ts`: count and hash in a `Transform` that passes every chunk on, so the stream stays paused until yazl reads it. Nothing else changed.

**Tests:**

- New `packages/core/src/archives/zip-writer.test.ts`: writes a 200 KB file stream and a small in-memory stream, reads the archive back, and checks the bytes, the size and the SHA-256. It fails on the unfixed code ("expected false to be true") and passes with the fix.
- `packages/core/src/content-transfer/content-transfer.test.ts`: the export/import test now checks the imported picture has the same bytes, not only that it answers 200.
- `src/archives`, `src/backups` and `src/content-transfer` tests: 16 passed.

**Runtime verification (fixed code, server restarted):**

- Two PNGs uploaded (7,831 and 270,388 bytes), plus 40 filler pages so the database entries take longer to write.
- 12 backups in a row: every zip has `media/default/….png` at 7,831 and 270,388 bytes, and every restore preview answers 200.
- Round trip: backup, download, restore preview (200), delete one picture, restore (200), sign in again; both pictures are served with SHA-256 identical to the originals.
- `GET /content-export?files=true`: both media entries at their full size.

**Screenshots:** none; the fix has no visual part.

## LINTEL-FUNC-001: Closed basket drawer rendered over shop pages

**Status:** Verified.

**Root cause (confirmed):**

- `:where(.lintel-cart) { display: flex }` in `element-stylesheet.ts` is an author style, so it beats the browser's `dialog:not([open]) { display: none }`. The closed `<dialog class="lintel-drawer … lintel-cart">` was drawn on top of the page.
- The keyboard focus problem has the same cause: a closed dialog that is displayed keeps its close button and checkout link in the Tab order. Before the fix, 4 of 25 Tab presses on the product page landed inside the closed drawer.

**Change:**

- `packages/builder/src/render/elements/element-stylesheet.ts`: the rule now applies to `.lintel-cart:not(dialog)` (the basket page) and `.lintel-cart[open]` (the open drawer), mirroring `.lintel-drawer[open]`. Nothing else changed.

**Tests:**

- New browser test `packages/builder/src/browser-tests/shop-cart-drawer.test.ts` (real Chromium, real renderer and stylesheet), at 1440 and 390px: the closed drawer is `display: none` with no width, 8 Tab presses never reach it, the basket page keeps `display: flex`, and the drawer is `flex` once opened. It fails on the unfixed stylesheet (`display: 'flex', width: 384`) and passes with the fix.

**Runtime verification (`/products/linen-shirt`, desktop and 390px, light and dark):**

|                                    | Before                                                 | After                            |
| ---------------------------------- | ------------------------------------------------------ | -------------------------------- |
| Closed drawer                      | `display: flex`, 384×900 at x=1056 (343 wide at 390px) | `display: none`, 0×0             |
| Tab stops inside the closed drawer | 4 of 25                                                | 0 of 25                          |
| Click "Add to basket"              | times out (covered)                                    | adds; drawer opens with the line |

**Screenshots:**

- Before: [desktop light](screenshots/fix-shop/func-001-product-before-desktop-light.png), [desktop dark](screenshots/fix-shop/func-001-product-before-desktop-dark.png), [390 light](screenshots/fix-shop/func-001-product-before-390-light.png), [390 dark](screenshots/fix-shop/func-001-product-before-390-dark.png).
- After: [desktop light](screenshots/fix-shop/func-001-product-after-desktop-light.png), [desktop dark](screenshots/fix-shop/func-001-product-after-desktop-dark.png), [390 light](screenshots/fix-shop/func-001-product-after-390-light.png), [390 dark](screenshots/fix-shop/func-001-product-after-390-dark.png).
- Drawer opened by Add to basket: [desktop light](screenshots/fix-shop/func-001-drawer-open-after-desktop-light.png), [390 dark](screenshots/fix-shop/func-001-drawer-open-after-390-dark.png).

**Noticed, not fixed (new):** in the open drawer the "Check out" link is brand-coloured text on a brand-coloured button, so it reads as an empty purple bar. The site stylesheet's `a { color: var(--lintel-color-link) }` outranks the zero-specificity `:where(.lintel-button)`. It affects any `<a class="lintel-button">` on the website, so it is left for a separate decision.

## LINTEL-FUNC-002: "Choose delivery" throws a TypeError

**Status:** Fixed and verified up to the payment hand-off. Paying itself is Blocked here: no Stripe account can be connected without internet (see below).

**Root cause (confirmed):**

- The site's `ShippingRate` type was `{ id, name, price }`. The API answers `{ rateId, name, deliveryEstimate, amount }` (`ShippingQuote` in `core/src/commerce/shipping/shipping-quotes.ts`, `shippingRateOptionSchema` in `storefront.openapi.ts`). `formatMoney(rate.price)` read `.amount` of `undefined`.
- The `catch` in the basket form put `error.message` on the page, so the shopper saw the JavaScript error. "Add to basket" had the same pattern.
- Nothing tied the two sides together: core can't be imported by the builder, and the site script had no tests.

**Change:**

- `packages/builder/src/site-behaviours/shop-api.ts`: `ShippingRate` now matches the API. New `describeShippingRate` ("Standard, £4.95 (2 to 3 working days)") and `shopperMessage`, which shows the shop API's own messages (written for shoppers) and a plain sentence for anything else.
- `cart-views.ts`: the radio's value is `rateId`; the label comes from `describeShippingRate`; failures go through `shopperMessage`.
- `shop-behaviours.ts`: "Add to basket" failures go through `shopperMessage` too.
- `packages/builder/package.json`: new export `@lintel/builder/site-shop-api` (types and code of `shop-api.ts`) so core can test against it.
- `packages/core/src/commerce/storefront/storefront.openapi.ts`: `shippingRateOptionSchema` is exported for the contract test.
- `element-stylesheet.ts`: the delivery choices had never been seen, because the step always failed. Once shown, the basket form's `label` rule (flex column, bold) overrode the existing `.lintel-form__choice` row style, so the radio sat above its text in a browser-default fieldset box. The label rule now skips `.lintel-form__choice`; the rates fieldset gets the same reset as the variant picker's (no border, margin or padding), and its legend matches the other labels. `display: grid` applies only when the fieldset isn't `hidden`, so it stays hidden until there are rates.

**Tests:**

- New contract test `packages/core/src/commerce/storefront/storefront-site-contract.test.ts`: it asks the real storefront API (test server) for a cart's delivery rates, parses the answer with the OpenAPI `shippingRateOptionSchema`, assigns it to the site's `ShippingRate[]` (a typecheck error if they drift apart) and runs it through the site's `describeShippingRate`. With the old site type it fails both ways: at runtime with the original `TypeError: Cannot read properties of undefined (reading 'amount')`, and in `tsc` with `TS2322 … is not assignable to type 'ShippingRate[]'`.
- New jsdom test `packages/builder/src/site-behaviours/cart-views.test.ts`: Choose delivery lists "Standard, £4.95 (2 to 3 working days)" with value `rateId` and the button becomes "Pay now"; an API refusal shows the API's message; an unexpected `TypeError` shows "Something went wrong. Please try again." Two of the three fail on the unfixed code.
- `shop-cart-drawer.test.ts` (browser) also checks that the hidden rates fieldset stays `display: none`.

**Runtime verification (`/cart`, desktop and 390px, light and dark):**

- Before: "Cannot read properties of undefined (reading 'amount')" above Choose delivery; no rates.
- After: "Delivery: Standard, £4.95 (2 to 3 working days)" is listed and chosen; the button reads "Pay now".
- Pay now: the site updates the cart with the rate (200) and calls `POST /carts/:token/checkout`, which answers `409 SHOP_NOT_READY`: "Payments aren't set up yet. Connect Stripe in Shop → Settings → Payments first." The shopper sees that text. This is the hand-off point. Connecting Stripe needs internet, so the payment page itself was not reached. The API path through a faked Stripe is covered by `commerce.e2e.test.ts`, which passes.
- That 409 message is written for the shop owner, not the shopper. This is the prior review's "shoppers see an admin message" lead. It isn't in this fix's scope and is not changed.

**Screenshots:**

- Before: [desktop light](screenshots/fix-shop/func-002-delivery-before-desktop-light.png), [desktop dark](screenshots/fix-shop/func-002-delivery-before-desktop-dark.png), [390 light](screenshots/fix-shop/func-002-delivery-before-390-light.png), [390 dark](screenshots/fix-shop/func-002-delivery-before-390-dark.png).
- After: [desktop light](screenshots/fix-shop/func-002-delivery-after-desktop-light.png), [desktop dark](screenshots/fix-shop/func-002-delivery-after-desktop-dark.png), [390 light](screenshots/fix-shop/func-002-delivery-after-390-light.png), [390 dark](screenshots/fix-shop/func-002-delivery-after-390-dark.png); [Pay now hand-off](screenshots/fix-shop/func-002-paynow-after-desktop-light.png).
- The full-page captures show the site's sticky header part way down the page. That is how full-page screenshots draw a sticky header, not a defect.

## LINTEL-FUNC-003: Discounts are invisible on the website and the totals don't add up

**Status:** Verified.

**Root cause (confirmed):** the site's `Cart` type had no `discountCodes`, `discounts` or `discountProblems`. The basket drew only Subtotal, Delivery and Total. Nothing on the website set `discountCodes`.

**Change:**

- `packages/builder/src/site-behaviours/shop-api.ts`: `Cart` gains `discountCodes`, `discounts` (`CartDiscount`) and `discountProblems`, as in `cartSchema`. New pure `cartTotalRows(cart)`: Subtotal, then each discount as its own negative row ("Discount (SAVE10)"; an automatic discount uses its title), then Delivery, then Total.
  - The API has already taken a free-delivery discount off `shipping`. So Delivery is shown at full price with "Free delivery (CODE)" below it, and the rows still add up.
  - Before a delivery is chosen, free delivery shows as "Free".
- `cart-views.ts`:
  - totals come from `cartTotalRows`; deductions show as "−£9.00";
  - new `setUpDiscountCode` adds a "Discount code" box with an Apply button to the basket page, under the sums, using the existing cart `PATCH { discountCodes }`;
  - the codes in the basket are listed with a Remove button each;
  - the API's refusal ("This code isn't valid…", "Only one code can be used per order.") and `discountProblems` messages are shown by the box, in a `role="status"` paragraph;
  - the box is one element kept across re-renders, so typing isn't lost, and it is hidden while the basket is empty.
- `shop-behaviours.ts`: sets up the box with the basket.
- `element-stylesheet.ts`: layout for the box, reusing the add-to-basket row pattern and label style. The Apply button is the theme's existing `lintel-button--secondary`. `display` applies only when the box isn't `hidden`.

**Tests:**

- `packages/builder/src/site-behaviours/cart-views.test.ts` (jsdom), 4 new tests:
  - the rows for SAVE10 with delivery;
  - the rows for free delivery;
  - typing " save10 " sends `PATCH {discountCodes:["save10"]}`, clears the box, shows the discount line and a "Remove the code SAVE10" button;
  - a refused code shows the API's message by the box.
- `packages/core/src/commerce/storefront/storefront-site-contract.test.ts`, 2 new tests against the real API: a cart with SAVE10, and one with a free-delivery code, each with delivery chosen. The answer is parsed with `cartSchema`, assigned to the site's `Cart` (typecheck), and run through `cartTotalRows`. The rows must add up to the API's own total: 9000 − 900 + 495 = 8595, and 9000 + 495 − 495 = 9000.
- These tests can't run on the unfixed code at all: the box, the rows function and the cart fields don't exist there.

**Runtime verification (`/cart`, 2 × Linen shirt M, desktop and 390px, light and dark):**

| State                      | Before                                                                    | After                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Code box                   | none                                                                      | "Discount code" + Apply                                                                                                |
| Code `NOPE`                | –                                                                         | "This code isn't valid. Check it's typed correctly." by the box                                                        |
| `save10` applied           | (applied through the API) Subtotal £90.00, Total £81.00, no discount line | Subtotal £90.00 · Discount (SAVE10) −£9.00 · Total £81.00; "SAVE10 Remove"                                             |
| + delivery chosen          | –                                                                         | Subtotal £90.00 · Discount (SAVE10) −£9.00 · Delivery £4.95 · Total £85.95                                             |
| Remove SAVE10              | –                                                                         | Subtotal £90.00 · Delivery £4.95 · Total £94.95                                                                        |
| `FREESHIP` (free delivery) | –                                                                         | before delivery: Free delivery (FREESHIP) Free; after: Delivery £4.95 · Free delivery (FREESHIP) −£4.95 · Total £90.00 |
| SAVE10 then FREESHIP       | –                                                                         | "Only one code can be used per order." (the API's rule), SAVE10 kept                                                   |

**Screenshots:**

- Before: [desktop light](screenshots/fix-shop/func-003-cart-before-desktop-light.png), [desktop dark](screenshots/fix-shop/func-003-cart-before-desktop-dark.png), [390 light](screenshots/fix-shop/func-003-cart-before-390-light.png), [390 dark](screenshots/fix-shop/func-003-cart-before-390-dark.png).
- After: [desktop light](screenshots/fix-shop/func-003-cart-after-desktop-light.png), [desktop dark](screenshots/fix-shop/func-003-cart-after-desktop-dark.png), [390 light](screenshots/fix-shop/func-003-cart-after-390-light.png), [390 dark](screenshots/fix-shop/func-003-cart-after-390-dark.png).
- After, with delivery: [SAVE10](screenshots/fix-shop/func-003-cart-delivery-after-desktop-light.png), [FREESHIP](screenshots/fix-shop/func-003-cart-freeship-after-desktop-light.png).

## LINTEL-UX-003: Checkout country is a free-text box

**Status:** Verified.

**Root cause (confirmed):** `cart-views.ts` built the country as a 2-character `<input>` labelled "Country code (like GB)". The storefront API had no list of countries the shop delivers to: markets list where the shop sells, and shipping zones (where it delivers) are admin-only.

**Change:**

- `packages/core/src/commerce/storefront/storefront.service.ts` and `storefront.schema.ts`: each market in `GET /delivery/shop/markets` also lists `deliveryCountries`. These are its countries that a shipping zone with at least one rate covers. The change is additive; nothing existing is renamed. Documented in the storefront README and `packages/docs/…/building/commerce-api.md`.
- `packages/builder/src/site-behaviours/shop-api.ts`: `StorefrontMarket`, `deliveryCountriesOf`, `listDeliveryCountries`, and `countryName` (the country's name via `Intl.DisplayNames` in the page's language, or the code if that fails).
- `cart-views.ts`: the field is now a `<select>` labelled "Country", listing the delivery countries by name, sorted. It keeps the cart's country if there is one; otherwise it selects the page language's country when that is in the list. Until the list loads, or if it can't, the select holds the page language's country, which was the old box's default. The existing `.lintel-cart select` style applies.

**Tests:**

- `cart-views.test.ts` (jsdom): with markets UK (GB) and Europe (sells IE, FR, DE; delivers IE, FR), the select is labelled "Country" and offers exactly France, Ireland and United Kingdom, with GB selected. There is no text input.
- `storefront-site-contract.test.ts` (real API): a UK market with a zone and rate, and an Ireland market with no zone. The answer parses with `storefrontMarketSchema` and fits the site's type. `deliveryCountries` is `["GB"]` and `[]`, and the site offers `["GB"]`.
- `src/openapi` and storefront tests pass (7).

**Runtime verification:** markets United Kingdom (GB, zone + rate), Ireland (IE, zone + rate added) and Germany (DE, no zone). On `/cart` the Country select offers "Ireland" and "United Kingdom" only, with United Kingdom selected. Choose delivery still lists "Standard, £4.95 (2 to 3 working days)". Checked at desktop and 390px, light and dark.

**Screenshots:**

- Before (text box): [desktop light](screenshots/fix-shop/ux-003-country-before-desktop-light.png), [desktop dark](screenshots/fix-shop/ux-003-country-before-desktop-dark.png), [390 light](screenshots/fix-shop/ux-003-country-before-390-light.png), [390 dark](screenshots/fix-shop/ux-003-country-before-390-dark.png).
- After (select): [desktop light](screenshots/fix-shop/ux-003-country-after-desktop-light.png), [desktop dark](screenshots/fix-shop/ux-003-country-after-desktop-dark.png), [390 light](screenshots/fix-shop/ux-003-country-after-390-light.png), [390 dark](screenshots/fix-shop/ux-003-country-after-390-dark.png).
- Headless screenshots can't show an open native dropdown, so the option list is evidenced by the DOM readout above.

## LINTEL-VIS-001: Broken-image icon in basket lines without a picture

**Status:** Verified.

**Root cause (confirmed):** `lineItem` in `cart-views.ts` always created `<img src="">` (`line.image?.url ?? ""`), and the browser draws an empty `src` as a broken image.

**Change:**

- `cart-views.ts`: new `linePicture`. A line with a picture gets the `<img>` as before. A line without one gets a `span.lintel-cart__line-picture` (`aria-hidden`) holding the product page's own "no picture" icon.
- `packages/builder/src/render/elements/shop.tsx`: the basket drawer and basket page each server-render that icon once (`SiteIcon name="shopping-bag"`, the same one product cards and the gallery use) in a `<template class="lintel-cart__no-picture">`, for the script to copy. This avoids bundling the icon library into the site script.
- `element-stylesheet.ts`: the tile shares the `img` rule (4.5rem square, `--lintel-color-surface`, small radius). The icon is secondary text colour at 0.4 opacity, as on the empty product gallery.

**Tests:** `cart-views.test.ts` (jsdom). For a basket with one line without a picture and one with a picture: the first line has no `<img>` but an `aria-hidden` tile with the copied icon; the second keeps its `<img src>`. The builder's `src/render` tests and snapshots still pass (102 tests in `src/render` and `src/site-behaviours`).

**Runtime verification (`/cart` and the drawer, Linen shirt with no picture):** broken images on the basket page went from 1 to 0 at desktop and 390px, light and dark.

**Screenshots (basket line close-ups):**

- Before: [desktop light](screenshots/fix-shop/vis-001-line-before-desktop-light.png), [desktop dark](screenshots/fix-shop/vis-001-line-before-desktop-dark.png), [390 light](screenshots/fix-shop/vis-001-line-before-390-light.png), [390 dark](screenshots/fix-shop/vis-001-line-before-390-dark.png).
- After: [desktop light](screenshots/fix-shop/vis-001-line-after-desktop-light.png), [desktop dark](screenshots/fix-shop/vis-001-line-after-desktop-dark.png), [390 light](screenshots/fix-shop/vis-001-line-after-390-light.png), [390 dark](screenshots/fix-shop/vis-001-line-after-390-dark.png).
- Drawer after: [desktop light](screenshots/fix-shop/vis-001-drawer-after-desktop-light.png), [390 dark](screenshots/fix-shop/vis-001-drawer-after-390-dark.png).

## LINTEL-UX-002: "Commerce" vs "Shop" naming

**Status:** Verified.

**Root cause (confirmed):** the sidebar label `nav.commerce` in `packages/admin/src/i18n/strings.ts` said "Commerce". Everything inside the section says "Shop": the back link, "Shop settings", and core's own messages ("Connect Stripe in Shop → Settings → Payments").

**Change:**

- `packages/admin/src/i18n/strings.ts`: `nav.commerce` is "Shop". `features.keptContent.commerce` (shown when the shop is switched off) now says "the Shop section just hides".
- Docs that name the sidebar section now say Shop: `using/selling.md`, `using/moving-from-shopify.md` (Shop → Settings…, Shop → Move from Shopify), `using/getting-around.md` and `building/plugins.md`.
- Route paths (`/commerce/...`), code names and the "Online shop" feature name are unchanged. No layout or component was touched.

**Tests:** `packages/admin/src/navigation/sections.test.ts` now expects "Shop" in the sidebar labels when the shop is on, and not when it's off or not permitted. It fails against the old string. Navigation and i18n tests pass (21).

**Runtime verification:** the sidebar reads Dashboard · Content · Design · **Shop** · Media · Forms · Users · Settings · Help, with the Shop back link and "Products" heading under it. Checked at desktop and 390px, light and dark.

**Screenshots:**

- Before: [desktop light](screenshots/fix-shop/ux-002-sidebar-before-desktop-light.png), [desktop dark](screenshots/fix-shop/ux-002-sidebar-before-desktop-dark.png), [390 light](screenshots/fix-shop/ux-002-sidebar-before-390-light.png), [390 dark](screenshots/fix-shop/ux-002-sidebar-before-390-dark.png).
- After: [desktop light](screenshots/fix-shop/ux-002-sidebar-after-desktop-light.png), [desktop dark](screenshots/fix-shop/ux-002-sidebar-after-desktop-dark.png), [390 light](screenshots/fix-shop/ux-002-sidebar-after-390-light.png), [390 dark](screenshots/fix-shop/ux-002-sidebar-after-390-dark.png).
- At 390px the admin still overflows sideways (LINTEL-UX-001, the other fix agent's defect). That is visible in these captures and not changed here.

## LINTEL-DATA-002: Shopify-imported history contradicts itself on the customer page

**Status:** Verified (desktop). At 390px the admin is still covered by the uncollapsed sidebar (LINTEL-UX-001, another agent's defect), so there the content was checked by DOM readout, not by eye.

**Root cause (confirmed):**

- `sumCustomerOrders` (`core/src/commerce/customers/customers.repository.ts`) only reads `shop_orders`, so imported customers had `orderCount: 0` and `totalSpent: []`. That gave "Spent: Nothing yet".
- The customer page showed "No orders yet." whenever there were no live orders, directly above "Orders before the move".
- "Customer since" was the record's `createdAt`, which is the import date. Shopify's customer export has no "created" column, so the only original date the import has is the customer's first order.
- `GET /shop/archived-orders` already listed every imported order, but nothing in the admin outside the customer page showed it, so Orders read "0" with no pointer.

**Change:**

- Core:
  - `customers.repository.ts`: `sumCustomerOrders` adds archived orders to the order count and spend, per currency, net of refunds and without cancelled ones, exactly as for live orders. It also returns the earliest archived `placedAt`, cancelled orders included: a cancelled order still dates the customer.
  - `customers.service.ts` / `customers.schema.ts`: the customer gains `customerSince`, the earlier of `createdAt` and that first imported order. `createdAt` keeps meaning when the record was made. Nothing is rewritten in the database, so customers imported before this fix show correctly too. Documented in the customers README.
- Admin:
  - `CustomerDetailPage.tsx`: the subtitle uses `customerSince`. "No orders yet." shows only when there are neither live nor imported orders.
  - `OrdersPage.tsx`: when imported orders exist, the filter gains **Imported**. It lists them ("#1001 · ada@example.com", date, total, items, Shopify payment status) using the existing `GroupedList` rows and the existing "Imported from Shopify. Kept as records…" footer, and each row opens the customer's page. The search box filters this view by order number or email.
  - New strings `shop.orders.filterImported` and `shop.orders.importedRow` through `t()`.
  - `shopifyImport.api.ts` / `.queries.ts`: `listImportedOrders` and `useImportedOrders`, and `customerId` on the admin's `ArchivedOrder` type (the API already sent it).

**Tests:**

- `core/src/commerce/shopify-import/shopify-import.test.ts`: after importing the fixtures, Ada is `[1 order, £86.95, since 2026-03-01T10:14:02Z]`. Grace, whose only order was cancelled in Shopify, is `[0, [], since 2026-04-12T20:40:00Z]`. On the unfixed code this fails with `[0, [], undefined]`.
- New `admin/src/commerce/ImportedHistory.test.tsx`:
  - the customer page shows "Customer since Mar 1, 2026", "Orders before the move" and "£86.95", and no "No orders yet." or "Nothing yet.";
  - Orders → Imported lists both orders, with links to their customers, and search narrows them;
  - there is no Imported option when nothing was imported.
  - Two of the three fail on the unfixed screens.
- Admin `src/commerce` + `src/navigation` (31 tests) and core shopify-import + commerce e2e tests pass.

**Runtime verification (fixtures imported through `POST /shop/imports/shopify`):**

|           | Before                                                                                               | After                                                                                                                              |
| --------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Ada, API  | `orderCount: 0`, `totalSpent: []`, created = import date                                             | `orderCount: 1`, `totalSpent: [£86.95]`, `customerSince: 2026-03-01`                                                               |
| Ada, page | "Customer since Nov 2, 2026", "No orders yet." above "Orders before the move", "Spent: Nothing yet." | "Customer since Mar 1, 2026", "Orders before the move: #1001", "Spent: £86.95"                                                     |
| Orders    | All orders / To send / Sent / Refunded; "No orders yet"                                              | adds **Imported**: #1002 · grace@example.com ($18.50, refunded) and #1001 · ada@example.com (£86.95, paid); #1001 opens Ada's page |

Shopify's own export says Ada spent 104.00 across 2 orders. The fixture `orders.csv` holds only one of them, so £86.95 over 1 order is what Lintel has records for. Counting what's on record is deliberate.

**Screenshots:**

- Customer before: [desktop light](screenshots/fix-shop/data-002-customer-before-desktop-light.png), [desktop dark](screenshots/fix-shop/data-002-customer-before-desktop-dark.png), [390 light](screenshots/fix-shop/data-002-customer-before-390-light.png), [390 dark](screenshots/fix-shop/data-002-customer-before-390-dark.png).
- Customer after: [desktop light](screenshots/fix-shop/data-002-customer-after-desktop-light.png), [desktop dark](screenshots/fix-shop/data-002-customer-after-desktop-dark.png), [390 light](screenshots/fix-shop/data-002-customer-after-390-light.png), [390 dark](screenshots/fix-shop/data-002-customer-after-390-dark.png).
- Orders: [before](screenshots/fix-shop/data-002-orders-before-desktop-light.png), [before dark](screenshots/fix-shop/data-002-orders-before-desktop-dark.png), [after](screenshots/fix-shop/data-002-orders-after-desktop-light.png), [after dark](screenshots/fix-shop/data-002-orders-after-desktop-dark.png); Imported view [light](screenshots/fix-shop/data-002-orders-imported-after-desktop-light.png), [dark](screenshots/fix-shop/data-002-orders-imported-after-desktop-dark.png), [390](screenshots/fix-shop/data-002-orders-imported-after-390-light.png) (sidebar overlap from UX-001).
