# Lintel 1.0.0-rc.1: bug report

Discovery pass, 2 Nov 2026, `release/1.0.0-rc` at `66b6b9b`. Every defect below was reproduced at runtime in this pass unless its Evidence says otherwise.

**Common environment:**

- Linux;
- Chromium 1243 headless (Playwright 1.63);
- dev servers: API :4730, site :3730, admin :5730;
- built-in database;
- shop enabled at setup;
- market GB/GBP;
- zone UK with Standard £4.95;
- product `linen-shirt` (M £45, L £50);
- discount `SAVE10` (10% off everything).

Viewport is 1440x900 unless stated.

## Summary

| ID              | Priority | Summary                                                                                                                  | Prior-review lead                                                     |
| --------------- | -------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| LINTEL-DATA-001 | P0       | Backups store media files as 0 bytes; restore is refused as "damaged"                                                    | Backups lose media: **confirmed**                                     |
| LINTEL-FUNC-001 | P0       | Closed basket drawer is rendered over every shop page and blocks Add to basket                                           | Shop drawer: **confirmed**                                            |
| LINTEL-FUNC-002 | P0       | "Choose delivery" fails with a JavaScript TypeError; checkout cannot proceed                                             | Checkout error: **confirmed**                                         |
| LINTEL-FUNC-003 | P1       | No discount-code entry on the website; the applied discount isn't shown, so the totals don't add up                      | Discounts invisible: **confirmed**                                    |
| LINTEL-UX-001   | P1       | Admin overflows horizontally at 390px; the sidebar never collapses                                                       | Admin at 390px: **confirmed**                                         |
| LINTEL-FUNC-004 | P1       | A site with a path prefix (`/ie`) returns 404 for all its pages                                                          | Multisite path prefix: **confirmed**                                  |
| LINTEL-SPEC-001 | P2       | Children go live under an unpublished parent; the site's home placeholder text is then wrong                             | Unpublished parents: **confirmed**                                    |
| LINTEL-SPEC-002 | P2       | Published pages are never added to a menu; the site has no navigation                                                    | New pages never appear in menus: **confirmed**, re-classified as SPEC |
| LINTEL-FUNC-005 | P2       | Builder Header/Footer insert at the selection with placeholder content, duplicating the site header/footer               | Builder Header/Footer: **confirmed**                                  |
| LINTEL-DATA-002 | P2       | After a Shopify import, the customer shows "No orders yet", "Spent: Nothing yet" and the import date as "Customer since" | Shopify import: **confirmed** (orders are archived by design)         |
| LINTEL-FUNC-006 | P2       | The Updates screen says "couldn't reach the update feed" and "You're up to date" at once                                 | Updates screen: **confirmed**                                         |
| LINTEL-FUNC-007 | P2       | No admin screen to create product collections, yet discount copy says "Make one"                                         | Shop collections: **partly reproduced**                               |
| LINTEL-UX-002   | P3       | "Commerce" in the sidebar, "Shop" in the breadcrumb and page titles                                                      | Naming: **confirmed** for Commerce/Shop                               |
| LINTEL-UX-003   | P3       | Checkout country is a free-text "Country code (like GB)" box                                                             | **Confirmed**                                                         |
| LINTEL-VIS-001  | P3       | A basket line for a product without a picture shows a broken-image icon                                                  | New                                                                   |

**Counts:** P0 3, P1 3, P2 6, P3 3.

---

## LINTEL-DATA-001: Backups store media files as 0 bytes; restore is refused

- **Location:**
  - Settings → Backups;
  - `POST /backups`;
  - `packages/core/src/archives/zip-writer.ts` (`addStream`).
- **Environment:** common; media on local disk.
- **Severity:** P0. The backup reports `complete` but cannot be restored, so there is silent loss of the only recovery path.

**Reproduction steps:**

1. Upload any image (a 7,831-byte PNG was used): `POST /media`.
2. `POST /backups`, then wait until `GET /backups` shows `status: complete`.
3. Download it: `GET /backups/:id/download`.
4. List the zip entries.
5. `GET /backups/:id/restore-preview`.

**Expected:** `media/default/<id>.png` is 7,831 bytes, and the restore preview succeeds.

**Actual:**

- The zip entry `media/default/9abb56cd-….png` has `file_size 0`.
- `manifest.json` records `size: 7831` and a SHA-256 for it.
- The restore preview answers 400 `BACKUP_DAMAGED`: "This backup is damaged: media/default/9abb56cd-….png isn't what it was when the backup was made. Nothing was changed."
- The backup list still shows the backup as `complete` (19,351 bytes).

**Evidence:** zip listing and API answers are recorded in TEST-RESULTS.md (TC-BACKUP-001).

**Root cause (hypothesis, medium confidence):**

- `addStream` attaches a `'data'` listener to the `PassThrough` counter. That switches the stream into flowing mode before yazl starts reading the entry.
- The hash and size see every chunk; yazl receives none.
- `content-export.service.ts` uses the same function, so content exports are probably affected too (not run).

**Proposed fix:**

- Count and hash in a `Transform` that pushes each chunk on, or pipe the source into the counter only once yazl reads.
- Add a test that writes a non-empty stream and reads it back.

**Visual/UX impact:** none directly. The user believes they have a backup.

**Confidence:** High (defect); Medium (root cause). **Status:** Open.

## LINTEL-FUNC-001: Closed basket drawer rendered over shop pages

- **Location:**
  - website product/shop pages;
  - `<dialog class="lintel-drawer lintel-drawer--right lintel-cart">`;
  - `packages/builder/src/render/elements/element-stylesheet.ts` (`:where(.lintel-cart) { display: flex; … }`).
- **Severity:** P0. Shoppers cannot add to the basket.

**Reproduction steps:**

1. Open `http://localhost:3730/products/linen-shirt`.
2. Look at the right side of the page.
3. Click "Add to basket".

**Expected:** the drawer is hidden until the basket button opens it.

**Actual:**

- The closed dialog has `open=false` but computed `display:flex`, and it occupies x=1056, w=384, h=900.
- It shows "Basket / Your basket is empty." with a close button, and covers the right of the page, including part of "Add to basket".
- Playwright's click on "Add to basket" times out: the element never becomes actionable.

**Evidence:** `screenshots/50-site-product-page.png`.

**Root cause (confirmed by computed style):**

- `.lintel-cart { display:flex }` is an author style, so it overrides the user-agent `dialog:not([open]) { display:none }`.
- The generic drawer rule correctly scopes its flex display to `.lintel-drawer[open]`.

**Proposed fix:** scope the cart rule to the open state or the page view (e.g. `.lintel-cart[open], .lintel-cart:not(dialog)`), mirroring `.lintel-drawer[open]`.

**Visual/UX impact:** high. Every shop page looks broken.

**Confidence:** High. **Status:** Open.

## LINTEL-FUNC-002: "Choose delivery" throws a TypeError

- **Location:**
  - website `/cart`, Delivery details;
  - `packages/builder/src/site-behaviours/cart-views.ts:168`;
  - `shop-api.ts:152-163`.
- **Severity:** P0. No order can be placed from the website.

**Reproduction steps:**

1. Have a cart with a line in it.
2. Open `/cart`.
3. Fill in Email, Full name, Address, Town or city, Postcode, and Country code "GB".
4. Press Choose delivery.

**Expected:** a Delivery list shows "Standard, £4.95", and the button becomes "Pay now".

**Actual:** the message "Cannot read properties of undefined (reading 'amount')" appears above the button, and no rates are listed. The raw JavaScript error is shown to the shopper.

**Evidence:** `screenshots/55-site-choose-delivery-error.png`.

**Root cause (confirmed by code and API answer):**

- The storefront API returns `{rateId, name, deliveryEstimate, amount}` (`core/src/commerce/shipping/shipping-quotes.ts:44`; `storefront.openapi.ts`).
- The site's `ShippingRate` type expects `{id, name, price}`.
- `formatMoney(rate.price)` therefore reads `.amount` of `undefined`. `radio.value = rate.id` would also be `undefined`.

**Proposed fix:**

- Map to the API shape (`rateId`, `amount`), and show `deliveryEstimate`.
- Replace raw error text with a shopper-facing message.
- Add a contract test that uses the storefront OpenAPI schema.

**Visual/UX impact:** checkout is blocked, and a developer message is shown to the shopper.

**Confidence:** High. **Status:** Open.

## LINTEL-FUNC-003: Discounts are invisible on the website and the totals don't add up

- **Location:**
  - website `/cart`;
  - `cart-views.ts` (no `discount` handling);
  - admin discount editor copy.
- **Severity:** P1.

**Reproduction steps:**

1. Create code discount `SAVE10` (10% off everything).
2. Through the storefront API, create a cart, add 2 × Linen shirt M, and `PATCH {discountCodes:["SAVE10"]}` (answers 200).
3. Open `/cart`.

**Expected:**

- A field to enter a code. The admin says "Shoppers type the code in their cart."
- A discount line, so that Subtotal − discount = Total.

**Actual:**

- The page shows "Subtotal £90.00" and "Total £81.00", with no discount line and no code field.
- `cart-views.ts` and `shop-api.ts` contain no discount handling.

**Evidence:** `screenshots/54-site-cart-with-items.png` and `screenshots/63-discount-edit.png`.

**Root cause (confirmed by code search):** the cart response's `discounts[]` and `discountProblems[]` are never rendered, and there is no UI that sets `discountCodes`.

**Proposed fix:**

- Add a code input and Apply button to the basket page, using the existing cart PATCH.
- Render `discounts[]` as lines.
- Render `discountProblems[]` next to the field.

**Visual/UX impact:** shoppers can't use codes, and the totals look wrong.

**Confidence:** High. **Status:** Open.

## LINTEL-UX-001: Admin overflows horizontally at 390px

- **Location:**
  - admin shell (`packages/admin/src/layout/AdminLayout.tsx`, `Sidebar.tsx`).
- **Environment:** 390x844, touch, `isMobile`.
- **Severity:** P1 (serious usability obstacle on phones; also WCAG 1.4.10 Reflow).

**Reproduction steps:** sign in at 390px and open `/`, `/content` and `/commerce/products`.

**Expected:** the navigation collapses to a menu, and no horizontal scroll.

**Actual:**

- `scrollWidth` is 511 on Dashboard, 724 on Content and 614 on Products (viewport 390).
- The full sidebar (about 240px) stays open, and the content is cut off.
- 820px tablet: no overflow (pass).

**Evidence:**

- `screenshots/40-mobile-dashboard.png`;
- `screenshots/41-mobile-content.png`;
- `screenshots/42-mobile-products.png`;
- `screenshots/43-tablet-content.png`.

**Root cause:** not investigated (hypothesis: the sidebar has no small-screen breakpoint).

**Proposed fix:** below about 768px, hide the sidebar behind the existing menu pattern (a drawer opened from a header button). Do not introduce new visual styles.

**Visual/UX impact:** high on phones.

**Confidence:** High. **Status:** Open.

## LINTEL-FUNC-004: Path-prefix site returns 404

- **Location:**
  - Settings → Sites;
  - website server;
  - `GET /delivery/sites/match`.
- **Severity:** P1. A documented feature (guide §12, "a path (for example `/ie`)") doesn't work.

**Reproduction steps:**

1. `POST /sites` with `{handle:"ie", name:"Ireland", pathPrefix:"/ie", defaultLocale:"en-IE"}` (answers 201).
2. Create "Irish home" on that site and publish it. The site's `entryCount` becomes 1.
3. Fetch `http://localhost:3730/ie`, `/ie/` and `/ie/irish-home`.

**Expected:** `/ie` serves "Irish home".

**Actual:**

- All three return 404 "Page not found | QA Shop".
- `GET /delivery/sites/match?url=http://localhost:3730/ie/irish-home` answers 404 `SITE_NOT_FOUND`: "No site answers on localhost:3730. Add it to a site's domains in Settings → Sites."

**Evidence:** TEST-RESULTS.md (TC-MULTI-001).

**Root cause (hypothesis):** site matching requires a hostname match before it considers `pathPrefix`. A path-only site on the default host is never matched.

**Proposed fix:** fall back to the default host and match by path prefix. Add a site-server test.

**Visual/UX impact:** not applicable.

**Confidence:** High (defect); Low (cause). **Status:** Open.

## LINTEL-SPEC-001: Child pages go live under an unpublished parent; home placeholder is wrong

- **Location:**
  - content tree publishing;
  - website `/`.
- **Severity:** P2. The guide doesn't say whether this should be allowed; the misleading site text is a confirmed defect.

**Reproduction steps:**

1. Create Home (draft) and "About us" under it.
2. Publish only About us.
3. Fetch `/` and `/about-us`.

**Expected:** undefined by the spec. Umbraco-style CMSs block it or warn. The placeholder text should at least be accurate.

**Actual:**

- `/about-us` is live (200).
- `/` shows "This website is ready for its first page. Publish a page in Lintel and it appears here. A page with the address "home" becomes the home page." This is shown although a page _is_ published and a page with the address `home` exists, and it contradicts the guide ("The first top-level page is the home page").
- The URL is `/about-us`, not `/home/about-us`. That is consistent with Home being the home page, but surprising while Home is unpublished.

**Proposed fix:**

- Decide the rule. Either:
  - warn when publishing under an unpublished parent; or
  - offer "Publish with parent".
- Correct the placeholder copy to match the actual home-page rule.

**Confidence:** High (behaviour). **Status:** Open; needs a product decision.

## LINTEL-SPEC-002: Published pages are never added to a menu

- **Location:**
  - Content → Menus → Main menu;
  - the site header.
- **Severity:** P2.

**Reproduction steps:** publish a page (see SPEC-001), then `GET /navigation/main` and view the site.

**Actual:**

- Main menu has `itemCount: 0`.
- The site header shows only the site name, so visitors can't reach About us.
- Nothing in the publish flow offers to add the page to a menu.

**Expected:** unspecified. The guide only says applying a starter template can add pages to the main menu. Logged as a requirement gap, not a defect.

**Proposed fix (for decision):** an "Add to main menu" option on first publish, or a menu that follows the tree by default.

**Evidence:** `screenshots/65-menu-main.png`.

**Status:** Open; needs a product decision.

## LINTEL-FUNC-005: Builder Header/Footer insert at the selection with placeholders and duplicate the site's own

- **Location:**
  - builder Insert panel;
  - Header element;
  - "Footer with columns" section.
- **Severity:** P2. There is a workaround (drag in Layers, delete duplicates), but the default result looks broken when published.

**Reproduction steps:**

1. Open About us → Design.
2. Skip the tour.
3. Add elements → Heading.
4. Search "Header" and click it.
5. Search "Footer" and click the first result.

**Expected:**

- The header goes at the top and the footer at the bottom, or they replace the site's built-in ones.
- The header shows the site name.

**Actual:**

- The Header lands _below_ the Heading, showing "Your site" and a Menu button.
- The footer lands mid-page with placeholder links ("Explore / About / Contact / Follow / Newsletter").
- The site's built-in header ("QA Shop") and footer ("QA Shop © 2026") still render above and below, so there are two headers and two footers.

**Evidence:** `screenshots/71-builder-header-footer.png`.

**Proposed fix:**

- Insert Header at the start of the page and Footer at the end, regardless of selection.
- Bind the Header's brand text to the site name.
- Hide the built-in header/footer when the page has its own, or warn.

**Confidence:** High. **Status:** Open.

## LINTEL-DATA-002: Shopify-imported history contradicts itself on the customer page

- **Location:**
  - Commerce → Customers → customer;
  - Commerce → Orders;
  - `core/src/commerce/shopify-import`.
- **Severity:** P2. By design, imported orders are kept as archived records (`GET /shop/archived-orders`), not live Orders, so "orders missing from Orders" is not itself a defect.

**Reproduction steps:**

1. Import the fixture CSVs from `core/src/commerce/shopify-import/fixtures/`. The report says 2 orders and 2 customers created; one customer was refused for having no email.
2. Open Orders.
3. Open customer Ada Lovelace.

**Actual:**

- Orders: "0", with no pointer to the imported orders.
- Ada:
  - "No orders yet." sits directly above "Orders before the move: #1001 Mar 1, 2026 · £86.95";
  - "Spent: Nothing yet." (Shopify's export says 104.00 across 2 orders);
  - "Customer since Nov 2, 2026", which is the import date.
- API: `orderCount: 0`, `totalSpent: []`.

**Expected:** the customer summary counts or labels the imported history, and Orders points to the imported orders.

**Evidence:** `screenshots/60-customer-ada.png` and `screenshots/62-orders-after-import.png`.

**Proposed fix:**

- Include archived orders in the Spent and order-count figures (or label them "since moving to Lintel").
- Hide "No orders yet" when archived orders exist.
- Add a link to archived orders from Orders.

**Confidence:** High. **Status:** Open.

## LINTEL-FUNC-006: Updates screen shows a failure and "You're up to date" together

- **Location:** Settings → Updates.
- **Severity:** P2. The status is misleading; the outbound block itself is environmental.

**Reproduction steps:** open Settings → Updates while the feed is unreachable.

**Actual:**

- A warning: "Lintel couldn't reach the update feed (The update feed answered 403)…".
- Below it, a card: "You're up to date. Lintel 1.0.0-rc.1 is the newest version."
- The "How this site is updated" box suggests `pnpm lintel update --to 1.0.0-rc.1`, which is the current version.

**Expected:** when the check failed, say the status is unknown; don't claim "up to date".

**Evidence:** `screenshots/21-updates.png`.

**Proposed fix:**

- Show the up-to-date card only after a successful check.
- Drop the raw "(… answered 403)" text, or move it behind details.

**Confidence:** High. **Status:** Open.

## LINTEL-FUNC-007: No admin screen to create product collections

- **Location:**
  - Commerce;
  - discount editor ("What it's for → Some collections").
- **Severity:** P2.

**Evidence:**

- **Code:** `packages/admin/src/commerce/commerceRoutes.tsx` registers no collections route.
- **Copy:** `discountStrings.ts:77` reads "There are no collections yet. Make one, or choose products instead."
- **Runtime:** no Collections entry in Commerce navigation. In this pass a collection existed only because the Shopify import created "Summer Edit" (`screenshots/67-discount-collections-scope.png`), so the empty-state text itself was **not** shown at runtime.

**Proposed fix:** add a minimal collections list/editor, or change the copy to point at products/Shopify import.

**Confidence:** Medium. **Status:** Open.

## LINTEL-UX-002: "Commerce" vs "Shop" naming

- **Evidence:**
  - the sidebar says "Commerce";
  - the Products back link says "< Shop" (`screenshots/31-products-dark.png`);
  - the settings page is titled "Shop settings" (`screenshots/26-shop-settings.png`).
- **Severity:** P3.
- **Proposed fix:** pick one term (the guide uses both) and apply it through `t()` strings.
- **Status:** Open.

## LINTEL-UX-003: Checkout country is a free-text box

- **Evidence:** the `/cart` field is labelled "Country code (like GB)" (`screenshots/55-site-choose-delivery-error.png`). Any typo means "We can't deliver to that address yet."
- **Severity:** P3.
- **Proposed fix:** a `<select>` of the market's countries.
- **Status:** Open.

## LINTEL-VIS-001: Broken-image icon in basket lines without a picture

- **Evidence:** `screenshots/55-site-choose-delivery-error.png`. `cart-views.ts:38-39` always creates an `<img>` with `src = line.image?.url ?? ""`.
- **Severity:** P3.
- **Proposed fix:** render the existing neutral placeholder (as on the product page) when `image` is null.
- **Status:** Open.
