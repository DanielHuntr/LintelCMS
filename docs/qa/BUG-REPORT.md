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

---

# Batch 2 (2 Nov 2026, `release/1.0.0-rc` at `73e47a2`, branch `qa/batch-2`)

**Status of the discovery defects above:** 15 were fixed on `release/1.0.0-rc` (see FIX-LOG-shop.md and FIX-LOG-site.md). Batch 2 did not re-verify them, except where a test below touched the same path (noted in TEST-RESULTS.md). Their entries above are kept unchanged as history.

**Environment for batch 2:**

- Linux, 8 GB, shared with one other fix run;
- dev servers: API :4770, site :3770, admin :5770; data folder `/tmp/qa2-data`; built-in database;
- set up through `POST /setup/finish` as "QA Two" with the shop;
- default email settings (no `EMAIL_DRIVER`, so the outbox);
- users: Owner, Admin, Editor, Viewer, a custom "Writer QA" role (`entries:read/create/update`, `media:read/upload`, `collections:read`, `blueprints:read`) and a custom "Settings reader" role (`settings:read` only);
- Chromium 1243 headless (Playwright from `packages/admin`), one worker; axe-core 4.14.0.

Logs referred to below are in `screenshots/batch-2/logs/`. Throwaway reset and invitation tokens in them are redacted.

## Batch 2 summary

| ID              | Priority | Summary                                                                                                                                                               |
| --------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LINTEL-SEC-001  | P0       | Anyone with `settings:read` (every Admin, or a "See settings" custom role) can read reset links in the email outbox and take over the Owner account                   |
| LINTEL-DATA-003 | P1       | Renaming a field's handle (in a content type or a fieldset) hides its values at once on the live site, and the next save of each entry deletes them                   |
| LINTEL-DATA-004 | P1       | Two editors on one entry: the second Save silently reverts the first editor's saved changes, including to fields the second editor never touched                      |
| LINTEL-DATA-005 | P2       | Adding a condition to a field that already holds values clears those values on the next save of each entry where the condition is false                               |
| LINTEL-FUNC-008 | P2       | Changing a field's type, or removing a select choice that entries use, is accepted; the affected entries then can't be saved at all                                   |
| LINTEL-FUNC-009 | P2       | Deeply nested rich text is accepted on save; the entry then answers 500 on open and publish (stack overflow)                                                          |
| LINTEL-SEC-002  | P2       | Global search (Ctrl K) lists titles, drafts included, from sites the person's role can't access                                                                       |
| LINTEL-A11Y-001 | P2       | Website basket drawer: closing it with Escape leaves focus on the page body, not on the button that opened it                                                         |
| LINTEL-A11Y-002 | P2       | Website checkout: after "Choose delivery" focus is lost; the next Tab starts again at "Skip to content"                                                               |
| LINTEL-A11Y-003 | P2       | At 320 CSS px (400% zoom) the entry editor and content type editor scroll sideways; the entry's "…" menu is pushed off-screen                                         |
| LINTEL-UX-004   | P3       | Titles have no length limit (10,000 characters accepted); a long unbroken title makes Content scroll sideways below 768px                                             |
| LINTEL-SEC-003  | P3       | Code saved while "allow scripts" was on keeps its scripts after the site is switched back to "remove scripts"                                                         |
| LINTEL-FUNC-010 | P3       | `PATCH /shop/settings` with nothing to change answers 500                                                                                                             |
| LINTEL-FUNC-011 | P3       | A damaged content export (bytes changed inside the zip) answers 500 instead of "this file is damaged"                                                                 |
| LINTEL-FUNC-012 | P3       | A delivery rate with no price is accepted, and its zone then can't deliver anywhere                                                                                   |
| LINTEL-UX-005   | P3       | Upload messages: an empty .png is refused as "looks like a .png file" (which is allowed); a safe-but-linked SVG is called "damaged"                                   |
| LINTEL-DATA-006 | P3       | Duplicate form submissions (same form token, same answers, milliseconds apart) are both stored                                                                        |
| LINTEL-A11Y-004 | P3       | Accessible names don't contain the visible text (WCAG 2.5.3) on tree items with counts, the account link and field settings buttons                                   |
| LINTEL-A11Y-005 | P3       | Contrast below 4.5:1 in the field picker's footer text (3.15:1) and the builder's breakpoint switch (4.41:1)                                                          |
| LINTEL-A11Y-006 | P3       | On the website's basket page the sticky header covers most of a field that the browser scrolls to for a validation message                                            |
| LINTEL-A11Y-007 | P3       | At 390px the entry editor's "Actions" (…) button is 20px wide and an inline text input 18px tall, under the 24px target size                                          |
| LINTEL-VIS-002  | P3       | The entry header shows two status badges at once: "Published" and "Published, with changes not yet published"                                                         |
| LINTEL-FUNC-013 | P3       | A collection list bound to a select field shows the stored value ("web"), not its label ("Web")                                                                       |
| LINTEL-SPEC-003 | P3       | Slugs must be unique across a whole tree collection, even under different parents, although addresses follow the tree                                                 |
| LINTEL-SPEC-004 | P2       | No conflict handling is specified for two people editing one entry (Scenario E); see DATA-004                                                                         |
| LINTEL-SPEC-005 | P3       | The guide's role examples ("design pages", "manage updates") have no matching permission; Admin carries `orders:*` and `automations:*`, which aren't in the catalogue |

**Counts (batch 2):** P0 1, P1 2, P2 8, P3 15 (26 in all; SPEC-004 is counted as P2).

**Not filed, by instruction:** the other fix run's leftovers were seen again and not re-filed: B/I/Link and Ctrl+B in rich text (Ctrl+B in the Body field made no `<strong>`), sidebar Search and Ctrl K contrast (4.45:1 and 2.86:1 on every admin screen in axe), the shopper-facing payments message, and the others in the brief.

---

## LINTEL-SEC-001: The email outbox lets `settings:read` take over the Owner account

- **Location:** Settings → Email outbox; `GET /email/outbox` (`packages/core/src/email/email.routes.ts`, guarded by `settings:read`); `POST /auth/forgot-password`; `POST /auth/reset-password`.
- **Environment:** batch 2 common. `EMAIL_DRIVER` not set, which is the default ("Until EMAIL_DRIVER is set, emails go to the outbox"). The production server only logs a warning in that case.
- **Severity:** P0. Privilege escalation to Owner (backups, restore, updates, owner management) from a permission the catalogue describes as "See settings".

**Reproduction steps:**

1. As Owner, make a role with only `settings:read` ("See settings"), and invite a user to it.
2. Signed out, `POST /auth/forgot-password {"email":"owner@qa2.test"}` → 202.
3. As the settings reader (or any Admin), `GET /email/outbox`. The answer holds "Reset your password · Lintel" to the Owner, with the link `…/reset-password#token=…`.
4. `POST /auth/reset-password {"token":"<token>","newPassword":"…"}` → 204.
5. Sign in as the Owner with the new password.

**Expected:** only the Owner can use a link sent to the Owner. Sign-in links and tokens aren't shown to other people, or the outbox is limited to Owners and hides tokens.

**Actual:**

- The Admin read the token and reset the Owner's password: 204. Sign-in as the Owner gave `permissions ["*"]`. In that session `POST /backups` (Owner only) answered 202.
- The "Settings reader" (permissions exactly `["settings:read"]`) got 200 from the outbox, with 11 messages, including reset and invitation links.
- Invitation links are there too, so the same people can accept pending invitations meant for others, under any role the Owner invited.

**Evidence:** `screenshots/batch-2/logs/sec-escalation.log` (tokens redacted). The Owner's password was restored the same way afterwards.

**Root cause (confirmed by code):** `GET /email/outbox` needs only `settings:read` and returns the full text of every message. The comment there says "The messages hold sign-in links", so the risk is known, but only caching is addressed.

**Proposed fix (smallest):**

- Require Owner (`requireOwner`) for the outbox.
- Mask one-time links (reset, invitation, email change, sign-in) in the outbox answer, except for messages addressed to the person reading it.
- Add a test: a non-Owner with `settings:read` gets 403, or sees no tokens.

**Visual/UX impact:** none. The screen would show masked links to non-Owners.

**Confidence:** High. **Status:** Open.

## LINTEL-DATA-003: Renaming a field's handle orphans its values

- **Location:** Settings → Content types → field → Basics → Handle; `PUT /blueprints/:handle`; `PUT /fieldsets/:handle`; entry save (`PATCH /entries/:id`).
- **Severity:** P1. Silent data loss on published content. Some old values can be recovered from History, one entry at a time.

**Reproduction steps:**

1. Make the content type "Service" (Title, Tagline, Price, Category, Details, Featured, Badge, and the fieldset "cta" with `cta_label` and `cta_url`), and the collection `services`.
2. Publish three entries with all fields filled in. Publish the page "Our services", whose collection list shows `data.tagline`, `data.badge`, `data.price` and `data.category`.
3. Change the Tagline field's handle from `tagline` to `strapline`, and save the content type (200, no warning).
4. Look at `/our-services` and `GET /delivery/services/service-2`.
5. Change only the title of Service 2 and save it (200).
6. In the fieldset "cta", change `cta_label` to `cta_text`, then save Service 1.

**Expected:** a warning that the handle holds data in N entries and that designs use it, with the values moved to the new handle (or the change refused).

**Actual:**

- After step 3, with nothing published, the live listing shows the design's placeholder ("y") instead of "Tagline 1/2/3". Delivery answers `"strapline": null`.
- After step 5, Service 2's stored data no longer has `tagline` at all (`… "strapline": null`). The value is gone from the entry. An older revision still contains it.
- Entries not re-saved keep the old key, so renaming back restores them. Re-saved ones stay lost.
- After step 6, Service 1's `cta` became `{"cta_url":"/contact","cta_text":null}`. "Go 1" was deleted.
- The page design's `data.tagline` binding isn't updated, so the published page is broken without anyone publishing it.

**Evidence:** `screenshots/batch-2/logs/scenD.log` (steps A, A+save, F, F+save); `screenshots/batch-2/scenD-site-listing.png`.

**Root cause (hypothesis, high confidence):** the save path keeps only keys that are in the current blueprint (unknown keys are dropped, which TC-NEG "unknown field" confirms). The blueprint update doesn't migrate keys or look for references.

**Proposed fix:** when a handle changes, move the values in the same transaction (`data->old` to `data->new`) for entries and their open revisions, and update `data.<old>` bindings in page designs. Alternatively, refuse the change while entries hold values, as the fieldset delete already does (409 FIELDSET_IN_USE).

**Confidence:** High. **Status:** Open.

## LINTEL-DATA-004: A second editor's Save silently reverts the first editor's changes

- **Location:** entry editor Save and autosave; `PATCH /entries/:id`.
- **Severity:** P1. A common two-person situation loses saved work without any message.

**Reproduction steps:**

1. Open "Shared page" as Editor (A) and as Owner (B) in two browsers.
2. A changes Summary to "Summary by A (UI)" and presses Save ("Saved").
3. B, without reloading, changes the Title and presses Save ("Saved").
4. Reload both.

**Expected:** not specified (see SPEC-004). At minimum, B's save shouldn't change fields B didn't edit, or B is told the entry changed since it was opened.

**Actual:**

- B's request body sends every field: `{"data":{"body":null,"title":"Title by B (UI)","design":null,"summary":"B2","hero_image":null}}`. A's summary is reverted to the value B loaded ("B2"), and both reloads show "B2".
- Neither editor is told. B sees "Saved". A, without reloading, keeps seeing their own text.
- There's no presence indicator, `ETag` or version check (`If-Match` is ignored). In the API, different-field saves are merged correctly, because PATCH merges per field; only the admin's whole-form save loses data.
- History keeps every save, so A's text can be restored by hand.

**Evidence:** `screenshots/batch-2/scenE-b-after-save.png`, `scenE-a-stale-after-b.png`; `logs/scenE.log`.

**Proposed fix (smallest):** send only changed fields from the editor. Then add an `updatedAt` precondition, and show "Changed by A since you opened it: Reload or Keep mine" on conflict.

**Confidence:** High. **Status:** Open.

## LINTEL-DATA-005: A new condition clears existing values on the next save

- **Location:** field Conditions tab; `keepHiddenValues` defaults to `false` (`packages/field-conditions/src/conditions.schema.ts:84`).
- **Severity:** P2. The setting is documented ("choose whether hidden values are kept or cleared"), but applying it to existing published content without a warning loses data silently.

**Steps:**

1. On Service, give Tagline the condition "Show when Featured is on" (keepHiddenValues left at its default).
2. Change only the title of Service 3 (Featured off, Tagline "Tagline 3"), then save and publish.

**Actual:** Service 3's `tagline` became `null`, also in delivery. Nothing warned when the condition was added, or when the entry was saved.

**Evidence:** `logs/scenD.log` (E2, E2+save).

**Proposed fix:** when conditions are added to a field that has values, warn with the count of entries that would lose them, and default to keeping them for existing fields.

**Confidence:** High. **Status:** Open.

## LINTEL-FUNC-008: Type changes and removed choices make existing entries unsaveable

- **Severity:** P2.
- **Steps:**
  1. Change Price from Number to Text.
  2. Separately, remove the choice "print", which Service 2 uses, from Category. Both content type saves answer 200 without a warning.
  3. Change only the title of Service 2 and save.
- **Actual:** 400 `{"price":"Price should be text","category":"Category should be one of: Web"}`. The editor can't save any change, including an unrelated one, until they fix fields they didn't touch. Publishing also fails. The live entry keeps the old values.
- **Evidence:** `logs/scenD.log` (B, C).
- **Proposed fix:** on the content type save, list the entries whose values no longer fit, and offer a conversion (number → text is lossless) or refuse.
- **Status:** Open.

## LINTEL-FUNC-009: Deeply nested rich text breaks the entry

- **Severity:** P2 (any author can create it, and it affects only that entry).
- **Steps:** `POST /collections/pages/entries` with a Body of 2,000 nested blockquotes → 201. Then `GET /entries/:id` → 500, and `POST /entries/:id/publish` → 500.
- **Log:** `RangeError: Maximum call stack size exceeded … innerDeepEqual`. Lists, search, the dashboard and content export still work. Delete works (204).
- **Proposed fix:** cap nesting depth in the rich-text value schema (for example at 50) on save.
- **Status:** Open.

## LINTEL-SEC-002: Global search leaks other sites' titles

- **Location:** `GET /search` (Ctrl K), guarded by sign-in only.
- **Severity:** P2. Titles and status only; opening the entry is refused (403 SITE_NOT_ALLOWED).
- **Steps:**
  1. Add site `ie`. Create "Irish secret draft" there.
  2. Restrict Editor to `default` (`PUT /sites/access/editor {"siteHandles":["default"]}`).
  3. As Editor, `GET /search?q=Irish`.
- **Actual:** both "Irish home" and "Irish secret draft" (`status: draft`) are returned. Every other route that was tried refused: list, get, patch, publish, revisions, duplicate, copy-to-site, delete, create with `?site=ie` and with `Lintel-Site: ie`. `/content-tree/search` returned nothing.
- **Evidence:** `logs/sec-multisite.log`.
- **Proposed fix:** filter `/search` by the person's allowed sites, as the tree search does.
- **Status:** Open.

## LINTEL-A11Y-001: Basket drawer doesn't return focus

- **Location:** website, `dialog.lintel-cart`.
- **Severity:** P2 (WCAG 2.4.3).
- **Steps:**
  1. Open `/products/linen-shirt`.
  2. Tab to "Add to basket" and press Enter. The drawer opens with focus inside it.
  3. Press Escape.
- **Actual:** the drawer closes, and `document.activeElement` is `body`. The next Tab starts at "Skip to content".
- **Expected:** focus returns to "Add to basket", or to the Basket button.
- **Evidence:** `logs/a11y-5.log`.
- **Status:** Open.

## LINTEL-A11Y-002: Checkout loses focus after "Choose delivery"

- **Severity:** P2 (WCAG 2.4.3; keyboard and screen-reader users lose their place in checkout).
- **Steps:** on `/cart`, fill in the delivery details by keyboard, focus "Choose delivery" and press Enter.
- **Actual:** the Delivery radio list appears, and focus is on `body`. The next Tab goes to "Skip to content". The same happens after "Pay now". There's no live-region text announcing the rates.
- **Evidence:** `logs/a11y-5.log`; `screenshots/batch-2/a11y-checkout-keyboard.png`.
- **Proposed fix:** move focus to the Delivery fieldset's legend (or the first rate), and announce "N delivery options" in the existing status region.
- **Status:** Open.

## LINTEL-A11Y-003: No reflow at 320 CSS px in the editors

- **Severity:** P2 (WCAG 1.4.10).
- **Steps:** use a 320x256 viewport (equal to 400% zoom at 1280) and open an entry and `/settings/content-types/service`.
- **Actual:**
  - Entry: `scrollWidth` 402. The "Published, with changes…" badge is `white-space: nowrap`, and it pushes the "Actions" (…) button to x=366–402.
  - Content type editor: 389, from the "Save address" row.
  - At 720px (200%) both fit. The website pages (listing, product, basket) fit at 320.
- **Evidence:** `logs/a11y-2.log`; `screenshots/batch-2/a11y-reflow-400-content.png` (the entry editor, full page at 320px) and `a11y-reflow-400-settings.png` (the content type editor).
- **Proposed fix:** let the header's badges wrap onto their own line below about 400px, and let the address row wrap.
- **Status:** Open.

## Batch 2 P3 defects (compact)

- **LINTEL-UX-004:** titles accept 10,000 characters (`POST` 201); the slug is cut to 80. At 720px and below, the Content landing's "Your recent edits" list becomes 95,998px wide (`scrollWidth`), because its title span doesn't truncate there. Desktop truncates correctly. **Fix:** a title maximum (such as 300) and `min-w-0`/truncate on the list row. Evidence: `logs/a11y-2.log`, `a11y-reflow-200-content.png`.
- **LINTEL-SEC-003:** with `customScripts` set to `allowScripts`, the Owner saved a Code element with `<script>` and `js`. After switching to `removeScripts`, `/owner-code` still serves `<script>alert(1)</script>`. New saves are cleaned. The guide says "Scripts are removed unless the site allows them". **Fix:** apply the rule when rendering too, or warn when switching. Evidence: `logs/sec-xss.log`.
- **LINTEL-FUNC-010:** `PATCH /shop/settings {}` as Admin → 500 (`Error: No values to set` in `shop-settings.repository.ts:36`). **Fix:** return the current settings when there's nothing to update.
- **LINTEL-FUNC-011:** uploading a content export with 60 bytes flipped → 500 (`Z_DATA_ERROR`). Truncated and empty files get friendly 400s, and nothing is imported in any case. **Fix:** map zlib errors to `UNREADABLE_ARCHIVE`. Evidence: `logs/imports.log`.
- **LINTEL-FUNC-012:** `POST /shop/shipping/zones/:id/rates {name, type:"flat", amount:495, currency:"GBP"}` → 201 with `amounts: {}`. Checkout then says "We can't deliver to that address yet." (The admin form wasn't tried; the API should refuse a rate with no price.)
- **LINTEL-UX-005:**
  - A 0-byte `empty.png` gets 415: "isn't a kind of file Lintel accepts. It looks like a .png file, whatever its name says", although PNG is accepted. It should say "This file is empty".
  - An SVG whose only problem is `<use href="https://…">` gets "looks like an image but can't be opened. It may be damaged". It should name the external reference.
- **LINTEL-DATA-006:** two JSON submissions of the contact form with the same `_token` and identical answers, 16ms apart, are both stored (2 submissions). It's unknown whether the embed script disables the button (not checked in a browser). **Fix:** accept a token once, or de-duplicate identical submissions within a few seconds.
- **LINTEL-A11Y-004:** axe `label-content-name-mismatch` (WCAG 2.5.3, serious) on:
  - tree items such as `li[aria-label="Services"]`, whose visible text includes the count "3";
  - `a[aria-label="Your account: Olive Owner"]`, which also shows the email;
  - field "… settings" buttons in the content type editor (9 nodes).
- **LINTEL-A11Y-005:** axe `color-contrast`: the field picker's footer text `.mt-auto` is #8e8e93 on #fbfbfc, 3.15:1; the builder's breakpoint radio label is 4.41:1. These are separate from the sidebar contrast leftover.
- **LINTEL-A11Y-006:** when "Choose delivery" fails browser validation, the browser scrolls the field to the top, and the sticky site header covers its label and most of the input (WCAG 2.4.11 is met only partly). Seen in the first keyboard run (the test script typed the address into the email field by mistake, so browser validation failed and scrolled to it); that screenshot was replaced by the later run, so the evidence is the description here plus `logs/a11y-5.log`. Re-capture when re-testing. **Fix:** `scroll-padding-top` equal to the header height.
- **LINTEL-A11Y-007:** at 390x844 with touch, the entry editor has `button "Actions"` 20x36 and an `input` 59x18 (WCAG 2.5.8 asks for 24x24 or enough spacing; spacing wasn't measured). The other screens tried had none (`logs/a11y-5.log`).
- **LINTEL-VIS-002:** a published entry with unsaved-to-live changes shows both "Published" and "Published, with changes not yet published" badges (`scenD-service2-after-rename.png`). One badge is enough.
- **LINTEL-FUNC-013:** a collection list text bound to `data.category` (Select) renders `web`/`print`, not the labels `Web`/`Print` (`logs/scenD.log`, baseline).
- **LINTEL-SPEC-003:** "kid" under About us and "kid" at the top level are refused ("Another entry in Pages already uses this slug"), although addresses follow the tree (`/about/its-name`). Decide whether that is intended.
- **LINTEL-SPEC-004:** there's no conflict or presence requirement in the guide. Decide the expected behaviour (last write wins per field, warn, or lock). DATA-004 is the concrete loss.
- **LINTEL-SPEC-005:** guide §13 says custom roles can tick "design pages" and "manage updates". The catalogue has neither: designing follows editing ("Anyone who can edit a page can design it"), and installing updates is Owner only. The built-in Admin role lists `orders:*` and `automations:*`, which `GET /permissions` doesn't offer while Automations is off.

# Batch 3 (2 Nov 2026, `release/1.0.0-rc` at `f6fa1da`, code review and UX pass)

Found by reading the code end to end, area by area (security, shop and forms, content and data, updates and extensions, admin, builder), and by a hands-on UX pass in Chromium at 1440px and 390px, light and dark. Each code finding was checked by reading its full path; the ones marked **Fixed** were also reproduced by a test that fails without the fix. Fixes are on `fix/security-review`; see `FIX-LOG-security.md`.

## Batch 3 summary

| ID              | Severity | Status | Defect                                                                                                                         |
| --------------- | -------- | ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| LINTEL-SEC-004  | P1       | Fixed  | Anyone with `users:invite` can resend a pending Owner invitation, get the new link and accept it themselves                    |
| LINTEL-SEC-005  | P1       | Fixed  | The content tree, recycle bin and SEO routes ignore site limits: a site-A editor can publish or bin site B                     |
| LINTEL-SEC-006  | P1       | Fixed  | A code block's CSS can close the page's `<style>` and add a script, even under "remove scripts"                                |
| LINTEL-SEC-007  | P1       | Fixed  | The code HTML cleaner parses differently from browsers; four known inputs keep a working `onerror`/`javascript:`               |
| LINTEL-DATA-007 | P1       | Fixed  | A scheduled publish puts live whatever was saved after scheduling, unchecked and unapproved                                    |
| LINTEL-DATA-008 | P1       | Fixed  | A visitor sending a product photo's bytes through a form, then the spam being deleted, deletes the photo                       |
| LINTEL-DATA-009 | P1       | Fixed  | A refund whose answer is lost is marked failed although Stripe made it; refunding again pays out twice                         |
| LINTEL-DATA-010 | P1       | Fixed  | Autosave sends the parent the editor opened with, quietly moving a page back after a move in the tree                          |
| LINTEL-FUNC-014 | P1       | Fixed  | ISK and UGX amounts go to Stripe in the wrong unit: the shopper pays 1% of the price                                           |
| LINTEL-FUNC-015 | P1       | Fixed  | A new entry's first autosave swaps the editor component, losing focus and words typed during the save                          |
| LINTEL-DATA-011 | P1       | Fixed  | Rolling back an update restores rows but not the old schema; the old version runs on the new tables                            |
| LINTEL-FUNC-016 | P1       | Fixed  | On Windows every one-click update after the first fails: renaming a junction over another gives EPERM                          |
| LINTEL-SEC-008  | P2       | Fixed  | Any API token, read-only included, can answer workflow approvals for the person who made it                                    |
| LINTEL-SEC-009  | P2       | Fixed  | `settings:update` alone can lift its own site limit, limit the Owner role, and change or delete other sites                    |
| LINTEL-SEC-010  | P2       | Fixed  | Two-factor can be set up again while on, swapping the authenticator with no password                                           |
| LINTEL-SEC-011  | P2       | Fixed  | A passkey can be added without the password, and survives a password reset                                                     |
| LINTEL-DATA-012 | P2       | Fixed  | Binning an entry clears its translations' links for good; restoring doesn't bring them back                                    |
| LINTEL-DATA-013 | P2       | Fixed  | A failed update restores a backup taken before the download, losing orders made while it downloaded                            |
| LINTEL-FUNC-017 | P2       | Fixed  | Moving a page in the tree doesn't check the new parent is on the same site                                                     |
| LINTEL-FUNC-018 | P2       | Part   | Which page is "/" depends on content type names and counts drafts                                                              |
| LINTEL-FUNC-019 | P2       | Fixed  | A shopper can switch the cart to another market's prices after giving a delivery address                                       |
| LINTEL-FUNC-020 | P2       | Fixed  | Builder: "The visitor leaves the page" animations never play                                                                   |
| LINTEL-FUNC-021 | P2       | Fixed  | Builder: duplicating keeps animation targets pointing at the original's elements                                               |
| LINTEL-FUNC-022 | P2       | Fixed  | Builder: generated class names can collide (`heading-2`), so styles bleed between elements                                     |
| LINTEL-FUNC-023 | P2       | Fixed  | One element that no longer validates hides the whole designed page on the website                                              |
| LINTEL-FUNC-024 | P2       | Fixed  | Switching workspace tabs or opening preview asks "Leave with unsaved changes?"                                                 |
| LINTEL-FUNC-025 | P2       | Fixed  | Dialogs close when a drag starts inside and ends outside; a new API token's one-time secret is lost                            |
| LINTEL-FUNC-026 | P2       | Fixed  | Webhooks reuse one time for a whole run: deliveries can be sent twice and signed minutes old                                   |
| LINTEL-FUNC-027 | P2       | Fixed  | The update supervisor doesn't recover from dying mid-switch                                                                    |
| LINTEL-FUNC-028 | P1       | Fixed  | Builder: dragging from Insert onto the page does nothing; only Layers takes drops                                              |
| LINTEL-FUNC-029 | P2       | Fixed  | Canvas effects lose their first frame; visitors who ask for less motion see no particles, frost or gradient                    |
| LINTEL-FUNC-030 | P1       | Fixed  | Mask reveal and section curtain/iris animations never play on the website, so their words stay hidden                          |
| LINTEL-DATA-014 | P1       | Fixed  | Renaming a delivery rate (or changing any one field) wipes its price, weight steps and delivery estimate                       |
| LINTEL-SEC-012  | P3       | Fixed  | Webhook signing secrets are shown to everyone with `settings:read`                                                             |
| LINTEL-SEC-013  | P3       | Fixed  | No rate limit on the password checks for turning two-factor off and making recovery codes                                      |
| LINTEL-SEC-014  | P3       | Fixed  | Cart tokens are written to the request log (they are in the path, not the query)                                               |
| LINTEL-UX-006   | P1       | Fixed  | A page's Body text vanishes from the website once it has a design; the editor still shows it (redesign)                        |
| LINTEL-UX-007   | P1       | Fixed  | Form notifications are on by default but nothing is sent without a mail service, and nothing says so                           |
| LINTEL-UX-008   | P1       | Fixed  | New products count stock from 0, so they show "Sold out" while the admin shows "On sale"                                       |
| LINTEL-UX-009   | P1       | Fixed  | The shop looks open before it can sell; checkout fails at the last step; no Shop link on the site (redesign)                   |
| LINTEL-UX-010   | P1       | Fixed  | Builder: Escape while editing text throws the edit away                                                                        |
| LINTEL-UX-011   | P2       | Fixed  | Builder: Publish gives no confirmation and the builder never shows unpublished changes                                         |
| LINTEL-UX-012   | P2       | Fixed  | No "View website" link anywhere in the admin                                                                                   |
| LINTEL-UX-013   | P2       | Fixed  | Builder spills off the screen at 390px; the tour still runs                                                                    |
| LINTEL-UX-014   | P2       | Part   | A menu with a link to a deleted page can't be saved, and the error shows the link's id                                         |
| LINTEL-UX-015   | P2       | Fixed  | Settings: logo and colour in two places; build-time settings where clients look first; unclear group names                     |
| LINTEL-UX-016   | P2       | Fixed  | Account is titled "Create your account"; three other strings show another screen's words                                       |
| LINTEL-UX-017   | P2       | Fixed  | Settings is a catch-all: logs, tools and the agency's build settings beside the owner's website details                        |
| LINTEL-UX-018   | P2       | Fixed  | The bright violet with lavender tints reads as a generic template, not the intended iOS look                                   |
| LINTEL-UX-019   | P2       | Fixed  | Tables capped at 896px with off-centre headings; Users header buttons far from the list; row hover matches the page            |
| LINTEL-UX-020   | P2       | Fixed  | The admin looked like any iOS-style app: nothing of its own                                                                    |
| LINTEL-UX-021   | P2       | Fixed  | Builder: elements can't be dragged to a new place on the page, only in Layers                                                  |
| LINTEL-UX-022   | P2       | Fixed  | Creating a page and opening one show two different editors; sparkle icons; Publish on an empty new page                        |
| LINTEL-UX-023   | P2       | Fixed  | A page's own header section doesn't replace the site's header (a footer section does), so two navs show                        |
| LINTEL-UX-024   | P2       | Fixed  | Builder: the Animation and Effects tabs feel clunky; people must know which is which                                           |     |
| LINTEL-UX-025   | P2       | Fixed  | Builder: no states like Framer's: a card can't animate its picture on hover; no pressed state; no scroll steps                 |
| LINTEL-UX-026   | P3       | Fixed  | The content tree's note goes after 8 seconds even while hovered or focused, and restarts when the tree re-renders              |
| LINTEL-UX-027   | P3       | Fixed  | The dashboard's "Add images and files" checks a permission no role has, so Authors who may upload never see it                 |
| LINTEL-UX-033   | P2       | Fixed  | Builder: the "Style for" dropdown makes no sense; its labels ("Lookbook: pointer over") don't say what they do                 |
| LINTEL-UX-034   | P2       | Fixed  | Insert search finds no element by other common names: "carousel" finds nothing (it's called Slider), nor "popup" or "lightbox" |
| LINTEL-UX-035   | P2       | Fixed  | Builder: adding motion shows a wall of choices ("26 choices", tall cards with paragraphs); "Always" is cut off at panel width  |
| LINTEL-UX-036   | P2       | Fixed  | Builder: styles are hard to reuse: summaries say "#111111", "Shared style: None" is a bare dropdown, variables are hidden      |
| LINTEL-UX-037   | P2       | Fixed  | Site cursor: clicking makes the circle jump far from the pointer (further the further from the window's corner)                |
| LINTEL-UX-038   | P2       | Fixed  | Every page gets the site's automatic header and footer, even one whose first row is its own menu; navigation can't be designed |
| LINTEL-UX-039   | P2       | Fixed  | Style: "What has to be hovered" always shows and lists plain layout boxes ("Container, 2 levels up") nobody recognises         |
| LINTEL-UX-040   | P3       | Fixed  | Style → Text says "1.125rem" but no size chip is pressed: a size no chip matches isn't shown, and rem means nothing to people  |
| LINTEL-UX-042   | P2       | Fixed  | Site cursor: the cursor, its word ("Play") and hover pictures freeze on top of a YouTube or Vimeo video                        |
| LINTEL-UX-043   | P2       | Fixed  | Motion timeline: the Trigger settings are squeezed into a narrow column in the side panel; labels overlap, selects unreadable  |
| LINTEL-UX-044   | P2       | Fixed  | Grow while scrolling can't start smaller than 60%: a video can't grow from a tenth of its size to full as the page scrolls     |
| LINTEL-UX-062   | P3       | Fixed  | The Motion panel's moment icons use bright stock iOS colours that clash with the warm admin                                    |
| LINTEL-UX-063   | P3       | Fixed  | A scroll scene's Start and End lines sit on the canvas's very edges by default, so they're hard to see or grab                 |
| LINTEL-UX-041   | P1       | Fixed  | No site-wide cookie notice: videos, maps, embeds and Adobe Fonts each asked alone (Adobe Fonts not at all), with no way back   |
| LINTEL-UX-060   | P2       | Fixed  | Builder: Tools: Beginner / Designer / Developer hides settings per person; the tour differs per level; a Code tab for few      |
| LINTEL-UX-061   | P2       | Fixed  | Style: two stacked controls for one question (Arrange → Place things, Layout → Arrange what's inside); "Normal" means nothing  |
| LINTEL-UX-045   | P2       | Fixed  | Adding a Navigation or Footer goes live on every page at once, while the top bar says "Not on your site yet"                   |
| LINTEL-UX-046   | P2       | Fixed  | A Navigation added to an empty page is hidden behind "This page is empty"                                                      |
| LINTEL-UX-047   | P2       | Fixed  | Deleting the site's navigation or footer only hides it on that page; nothing removes it from the site                          |
| LINTEL-UX-048   | P3       | Fixed  | The page's Design card squashes its heading to one word per line beside the button                                             |
| LINTEL-UX-049   | P3       | Fixed  | Move… lists only "The top of Pages" until something is typed                                                                   |
| LINTEL-UX-050   | P3       | Fixed  | Choosing Pages leaves the tree folded                                                                                          |
| LINTEL-UX-051   | P3       | Fixed  | "Which look you're changing" offers Open and Current for every element                                                         |
| LINTEL-UX-052   | P3       | Fixed  | Settings → Your website: "Template" means the blog and page style; a pairing is ticked though your own fonts are in use        |
| LINTEL-UX-053   | P3       | Fixed  | The forms "email isn't set up" warning is a dead end: no next step                                                             |
| LINTEL-UX-054   | P2       | Fixed  | Picture → Content shows a broken image and a raw /_lintel/ path for built-in illustrations, and says Picture three times       |
| LINTEL-UX-055   | P3       | Fixed  | Alt text has four names: Describe the picture, Alt text, description for screen readers, Name or description                   |
| LINTEL-UX-056   | P3       | Fixed  | A placed grid's columns show only while dragging, not while the grid is selected                                               |
| LINTEL-UX-057   | P3       | Fixed  | The content tree's right-click menu has no Rename                                                                              |
| LINTEL-UX-058   | P3       | Fixed  | Recycle bin: identical "Home" items can't be told apart                                                                        |
| LINTEL-UX-059   | P3       | Fixed  | The dashboard's "N images have no description" leads nowhere; the library can't list them                                      |
| LINTEL-UX-070   | P3       | Fixed  | The sidebar says Design and the page it opens says Templates                                                                   |
| LINTEL-UX-071   | P3       | Fixed  | Forms: "Form section" and "Form element" for the same thing; code and API cards sit beside "On a page"                         |
| LINTEL-UX-072   | P2       | Fixed  | The site fonts' words say "Lintel" in a white-labelled admin                                                                   |
| LINTEL-UX-073   | P3       | Fixed  | Site styles in Beginner show colour codes and "Gutter 1.5rem"                                                                  |
| LINTEL-UX-074   | P3       | Fixed  | Create asks "What would you like to make?" with one choice, Pages                                                              |
| LINTEL-UX-075   | P3       | Fixed  | Users says "It's just you so far" while an invitation is waiting                                                               |
| LINTEL-UX-076   | P3       | Fixed  | Style chips ignore the real look: a 600 button shows Weight Custom, a 1fr 1fr grid no Columns chip, a 17px button no size      |
| LINTEL-UX-077   | P2       | Fixed  | The pointer can't be designed: the word has one look, no own cursor picture, few per-element choices                           |
| LINTEL-UX-079   | P2       | Fixed  | The site cursor, its word and hover pictures are hidden behind the open phone menu drawer                                      |
| LINTEL-UX-078   | P2       | Fixed  | No text effects on hover for menus: a Menu's links can't be selected, styled one by one or given a look like a circle          |
| LINTEL-UX-081   | P2       | Fixed  | With less motion or no scripts, Atelier's "How a Hollin chair is made" sits in a sideways box showing only step 1              |
| LINTEL-UX-082   | P2       | Fixed  | The first-visit intro covers the page's own entrances: Atelier's letter-by-letter headline finishes under it                   |
| LINTEL-UX-083   | P3       | Fixed  | On phones a slider shows one slide with no sign of the next                                                                    |
| LINTEL-UX-084   | P3       | Fixed  | Slider arrow buttons are plain white and black whatever the site's colours                                                     |
| LINTEL-UX-085   | P3       | Fixed  | The intro counter starts in the device's own font, not the site's heading font                                                 |
| LINTEL-UX-086   | P2       | Fixed  | Site styles "N uses" counts only the open page; the delete warning doesn't say which other pages change                        |
| LINTEL-UX-087   | P2       | Fixed  | Deleting a downloaded Google Fonts file in the media library breaks that font with no warning                                  |
| LINTEL-UX-088   | P3       | Fixed  | Two command line tests fail on Windows because they expect Linux-style paths                                                   |
| LINTEL-UX-080   | P2       | Fixed  | Clients can't be given content-only access: anyone who edits a page can change its design                                      |
| LINTEL-UX-090   | P2       | Fixed  | No way to set words around a circle (a turning sticker) or along an arc or wave without code                                   |
| LINTEL-UX-091   | P2       | Fixed  | Lottie animations can't be used: the media library refuses .json and .lottie, and there is no element to play one              |
| LINTEL-UX-092   | P2       | Fixed  | Rive animations can't be used: the media library refuses .riv, and there is no element to play or interact with one            |
| LINTEL-UX-093   | P2       | Fixed  | Visitors can't pick up and throw a group of stickers or cards; the drag effects move one element alone, with no collisions     |

The full UX pass (about 35 findings, each marked small fix or redesign, with screenshots) is in `UX-PASS-batch-3.md`. Redesigns wait for Daniel's approval.

**Tooling found on the way (fixed):** with `core.autocrlf=true` and no `.gitattributes`, a Windows checkout failed `format:check` on 2,617 files and seven test files; the docs test built page addresses with backslashes. A `.gitattributes` now keeps LF everywhere, and the docs test uses forward slashes.

## UI and accessibility sweep (3 November 2026)

Found by the UI and accessibility sweep (desktop and 390px, light and dark, keyboard and screen reader names). All fixed on `fix/a11y-sweep`; see "UI and accessibility sweep fixes (3 November 2026)" in `FIX-LOG-ux.md`. The motion panel's moment colours were also raised; they wait for Daniel and aren't filed here.

| ID              | Severity | Status | Summary                                                                                                        |
| --------------- | -------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| LINTEL-A11Y-020 | P2       | Fixed  | At 390px, once scrolled, the entry editor's sticky bar covers the menu and help buttons                        |
| LINTEL-A11Y-021 | P2       | Fixed  | The form editor is 607px wide at 390px, so the whole screen scrolls sideways                                   |
| LINTEL-A11Y-022 | P2       | Fixed  | Tertiary text is 3.16:1 (light) and 4.0:1 (dark); green badge text is 3.38:1 on its tint                       |
| LINTEL-A11Y-023 | P2       | Fixed  | The phone menu isn't modal: Tab reaches the skip link, menu button, help and notifications behind it           |
| LINTEL-A11Y-024 | P2       | Fixed  | Links in the video and map consent notice take the site's link colour, 2.65:1 on the dark notice               |
| LINTEL-A11Y-025 | P2       | Fixed  | The admin's focus ring is about 2.8:1 against the page in light mode (3:1 needed)                              |
| LINTEL-A11Y-026 | P3       | Fixed  | Builder: shared style tiles show the default violet, not the site's own brand colour                           |
| LINTEL-A11Y-027 | P3       | Fixed  | The Studio template's home page trips its own "That's a lot of effects" warning as soon as one effect is added |
| LINTEL-A11Y-028 | P3       | Fixed  | The help panel's pictures show the old admin (blue and violet, old sidebar)                                    |
| LINTEL-A11Y-029 | P2       | Fixed  | Builder: Tab goes into the canvas and stops on the page's links, which do nothing there                        |
| LINTEL-A11Y-030 | P2       | Fixed  | At 390px the help panel covers the page but isn't modal; Escape only works with focus inside it                |
| LINTEL-A11Y-031 | P3       | Fixed  | "Create something new" opens with focus on the close button, not the Name field                                |
| LINTEL-A11Y-032 | P3       | Fixed  | Dashboard: "Open the media library" is a full-width pill; a row of widgets can end in a gap                    |
| LINTEL-A11Y-033 | P3       | Fixed  | The automatic site header doesn't line up with full-width pages, and "Shop" wraps under the name at 390px      |
| LINTEL-A11Y-034 | P3       | Fixed  | The video consent button says "Load Video" (title case, and "load" for a video)                                |
| LINTEL-A11Y-035 | P3       | Fixed  | Builder: closing the tour with Escape drops focus on the page body                                             |
| LINTEL-A11Y-036 | P3       | Fixed  | Grouped list names (Settings, Users and the rest) aren't headings; History's "Today" is an h4 under an h2      |
| LINTEL-A11Y-037 | P3       | Fixed  | Sign in: the error appears under "Sign in with a passkey", away from the fields and the Sign in button         |
| LINTEL-A11Y-038 | P3       | Fixed  | Builder: "Show a picture when hovered" is a native checkbox, unlike every other on/off control                 |

# Code review (3 Nov 2026, `release/1.0.0-rc`, branch `fix/review-findings`)

Found by a code review of the newer website, builder, fonts and motion work, and by Daniel's checks of Start from a template. Each was checked against the code first. Every fix has a regression test that fails without it. The fixes are logged in `FIX-LOG-ux.md`, "Code review fixes (3 November 2026)".

## Code review summary

| ID              | Severity | Status | Defect                                                                                                                                       |
| --------------- | -------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| LINTEL-CODE-001 | P1       | Fixed  | Applying a starter template silently replaces the site's own navigation and footer, even when its pages are added beside the site's own      |
| LINTEL-CODE-002 | P1       | Fixed  | "Choose a page" links in the site's navigation, footer and own blocks are published as `href="lintel:page/<id>"`                             |
| LINTEL-CODE-003 | P2       | Fixed  | Pictures in rich text leave out the photo credit their licence asks for                                                                      |
| LINTEL-CODE-004 | P2       | Fixed  | Builder: a site-styles change made just before closing is lost, and failed saves of the site's styles are never shown                        |
| LINTEL-CODE-005 | P2       | Fixed  | Builder: a failed save of the navigation or footer is swallowed and the change is dropped                                                    |
| LINTEL-CODE-006 | P2       | Fixed  | Site styles have no version check: a builder left open on an older copy overwrites someone else's newer styles                               |
| LINTEL-CODE-007 | P2       | Fixed  | The navigation and footer put the site's prefix and language on every "/…" link, breaking `/_lintel/…` files, `/menu.pdf` and `/fr/…`        |
| LINTEL-CODE-008 | P3       | Fixed  | Fonts: replaced or failed Google Fonts downloads are left in the media library; no limit per site; same-name race gives a database error     |
| LINTEL-CODE-009 | P3       | Fixed  | Hover picture loads the full-size file for every element as the page opens                                                                   |
| LINTEL-CODE-010 | P3       | Fixed  | Page transitions read every animated element's computed styles each time a page is left or arrives                                           |
| LINTEL-CODE-011 | P3       | Fixed  | Smooth scrolling reads computed styles up the element's ancestors on every wheel step                                                        |
| LINTEL-CODE-012 | P3       | Fixed  | The intro's "Skip intro" button is always in English, whatever the site's labels say                                                         |
| LINTEL-CODE-013 | P3       | Fixed  | Rules: the site effects route filters the request's keys itself instead of the service                                                       |
| LINTEL-CODE-014 | P2       | Fixed  | Start from a template, "Add them alongside": says "We'll add 4 pages" and counts Home as a clash, but adds 3 (the home page is skipped)      |
| LINTEL-CODE-015 | P2       | Fixed  | Start from a template: the look switch changes the live site at once, even with "Publish straight away" off, and is on when adding alongside |
| LINTEL-CODE-016 | P2       | Fixed  | Navigation and footer changes made in the builder go live at once, before the page is published                                              |

Not in scope: making site styles and site motion per site (a separate track, Daniel's decision).

## Starter sites: six more (batch A) (3 November 2026)

Found while building six new starter sites; see "Starter sites: six more (batch A)" in `FIX-LOG-ux.md` (LINTEL-UX-150 to 156 are the sites and their checks).

| ID            | Severity | Status | Summary                                                                                                                            |
| ------------- | -------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| LINTEL-UX-157 | P3       | Open   | The theme's soft grey is 4.25 to 4.43:1 on tinted paper in light mode: clock place names, table headings and form hints            |
| LINTEL-UX-158 | P3       | Open   | A template footer with a clock zone not on the list is silently replaced by the standard footer; Melbourne isn't listed            |
| LINTEL-UX-159 | P3       | Open   | Older templates fail the new checks: Atelier skips a heading level, Magazine lacks alt text, three keep header or footer in a page |

## Static publishing and deploy recipes (3 November 2026)

| ID            | Severity | Status | Defect                                                                                                                                              |
| ------------- | -------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| LINTEL-UX-120 | P1       | Fixed  | The production Docker image doesn't build: packages the API needs aren't installed or built, so Docker, Railway, Render and Fly.io deploys all stop |
| LINTEL-UX-121 | P1       | Fixed  | `pnpm deploy` in the Dockerfile looks for `@lintel/core` on npm and stops, through the Bookings example's peer dependency                           |
| LINTEL-UX-122 | P2       | Fixed  | `lintel doctor --hosting` can't find the hosting checker in a built copy, and says sharp isn't installed in the Docker image                        |
| LINTEL-UX-123 | P2       | Fixed  | Publishing to a folder fails on Windows: the temporary file's name is built from the full path                                                      |
| LINTEL-UX-124 | P2       | Fixed  | Forms on the website drawn from Form sections posted to the API's own address, not the website's                                                    |
| LINTEL-UX-125 | P2       | Fixed  | Timed jobs added since the cron request was written (backups, update checks, visitor counts) wouldn't have run from cron                            |
| LINTEL-UX-126 | P3       | Fixed  | A message from the PHP companion isn't shown under a builder form, and only the last ticked box of a question reaches it                            |

## External apps (3 November 2026)

Found while joining external apps to the release branch and checking Build → Apps in a browser. All fixed on `feature/external-apps`; see "External apps" in `FIX-LOG-ux.md`.

| ID            | Severity | Status | Summary                                                                                                         |
| ------------- | -------- | ------ | --------------------------------------------------------------------------------------------------------------- |
| LINTEL-UX-130 | P2       | Fixed  | Apps sat in Settings, apart from Add-ons in Build, with nothing saying how an app differs from an add-on        |
| LINTEL-UX-131 | P2       | Fixed  | Building an app on your own computer needed WEBHOOKS_ALLOW_PRIVATE_ADDRESSES, which opens every private address |
| LINTEL-UX-132 | P3       | Fixed  | Adding an app on localhost said "couldn't read the app's details … Check the address with the app's developer"  |
| LINTEL-UX-133 | P3       | Fixed  | An app's page said its name twice when its sidebar label is the app's name                                      |
| LINTEL-UX-134 | P3       | Fixed  | An app's details page: the Uninstall button sat far to the right of the narrower cards below it                 |
| LINTEL-UX-135 | P2       | Fixed  | An app could keep working after the person who installed it was deactivated (API tokens already stopped)        |

## Independent review of the night's work (4 November 2026)

A second reading of `dde71e4d..9943c3c1` on `fix/night-review`. All fixed there; `FIX-LOG-night-review.md` has the commits and the decisions left for Daniel.

| ID              | Severity | Status | Summary                                                                                                   |
| --------------- | -------- | ------ | --------------------------------------------------------------------------------------------------------- |
| LINTEL-CODE-017 | P1       | Fixed  | An add-on's Delete data and export could reach Lintel's own tables: an id of `shop` owned `shop_orders`   |
| LINTEL-CODE-018 | P1       | Fixed  | The PHP companion lost delayed payments: the money was taken and no order was made                        |
| LINTEL-CODE-019 | P2       | Fixed  | A publish could reach outside its folders: the path check never refused anything                          |
| LINTEL-CODE-020 | P2       | Fixed  | Find a person missed form entries holding the email anywhere but the form's first email answer            |
| LINTEL-CODE-021 | P2       | Fixed  | The orders retention rule left the customer's name, email, phone and addresses, still linked to the order |
| LINTEL-CODE-022 | P2       | Fixed  | Entries collected from a published site could be lost after a failed save, and had no consent record      |
| LINTEL-CODE-023 | P2       | Fixed  | An app kept being sent events, form answers included, after its installer was deactivated                 |
| LINTEL-CODE-024 | P3       | Fixed  | Personal data exports divided every order total by 100, so a yen total was wrong                          |
| LINTEL-CODE-025 | P3       | Fixed  | Deleting test orders could delete a real customer who had no orders here                                  |
| LINTEL-CODE-026 | P3       | Fixed  | One PayPal or Mollie payment that couldn't be read stopped the checks on all the others                   |
| LINTEL-CODE-027 | P3       | Fixed  | Add-on CSV exports let what a visitor typed run as a spreadsheet formula                                  |
| LINTEL-CODE-028 | P3       | Fixed  | `lintel-check.php` asked for PHP 8.1 when the companion needs 7.4                                         |
| LINTEL-CODE-029 | P3       | Fixed  | Two comments spoke of a hosted version of Lintel                                                          |
## Overnight QA and UX pass (4 November 2026)

A first-time website maker's journeys on a fresh install, in real Chromium, on `fix/night-qa` from `9943c3c1`. Fixes are in `FIX-LOG-night-qa.md`; screenshots in `screenshots/night-qa/`. Ranked by severity.

| ID              | Severity | Status | Summary                                                                                                                       |
| --------------- | -------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| LINTEL-FUNC-034 | P1       | Fixed  | A section from Insert goes inside what's selected: a column, or the section just added, so the second section of a page nests |
| LINTEL-FUNC-033 | P1       | Fixed  | With nothing selected, a new section goes after the site's footer until the page is reopened                                  |
| LINTEL-FUNC-035 | P1       | Fixed  | The basket total leaves out the ticked delivery until the payment page                                                        |
| LINTEL-FUNC-031 | P2       | Fixed  | A published page scrolls sideways on a phone while something waits to slide in from the right (Bakery, Our story)             |
| LINTEL-FUNC-032 | P2       | Fixed  | Blog and magazine publishes dead `/blog` links on a site with the blog off                                                    |
| LINTEL-FUNC-036 | P2       | Fixed  | A destination still says "Not published yet" after publishing, until the page is reloaded                                     |
| LINTEL-FUNC-037 | P2       | Open   | Translating a page before its parent makes it that language's home page: `/fr-FR` is "Our services". Needs Daniel's decision  |
| LINTEL-UX-302   | P2       | Fixed  | New sites and templates without their own footer publish "Replace this with your small print…"                                |
| LINTEL-UX-304   | P2       | Fixed  | "Market" in the shop: "To try it, you need a market", Add market, Primary                                                     |
| LINTEL-UX-305   | P2       | Fixed  | A refused product save says only "Some boxes need fixing", with the boxes far below; "making the product active"              |
| LINTEL-UX-306   | P2       | Fixed  | What Insert adds lands below the fold with the canvas left where it was, so nothing seems to happen                           |
| LINTEL-UX-315   | P2       | Fixed  | Back from a failed payment, the shopper's email and address are gone                                                          |
| LINTEL-UX-300   | P3       | Fixed  | The template dialog says "Pages you already have stay as they are" while Replace my pages is chosen                           |
| LINTEL-UX-301   | P3       | Fixed  | Template cards lower every letter: "djs"                                                                                      |
| LINTEL-UX-303   | P3       | Fixed  | Make a component shows `Now: var(--lintel-color-border)`                                                                      |
| LINTEL-UX-307   | P3       | Fixed  | An A/B test says "No visitors yet" over a version with 8 visitors                                                             |
| LINTEL-UX-308   | P3       | Fixed  | Media shows "646 byte"                                                                                                        |
| LINTEL-UX-309   | P3       | Fixed  | Adding an unreachable app shows `getaddrinfo ENOTFOUND nothing.invalid`                                                       |
| LINTEL-UX-310   | P3       | Fixed  | "Taxonomies" and "Hostnames…" in the content tree                                                                             |
| LINTEL-UX-311   | P3       | Fixed  | A client who opens /design is offered Use this template, then refused with a design error                                     |
| LINTEL-UX-312   | P3       | Fixed  | A page named after the site is titled "Mia's Studio \| Mia's Studio", as is the "no home page yet" page                       |
| LINTEL-UX-313   | P3       | Fixed  | The API reference overflows at 390px (403px wide)                                                                             |
| LINTEL-UX-314   | P3       | Fixed  | Updates says "plugins"; everywhere else says add-ons                                                                          |
| LINTEL-UX-316   | P3       | Open   | Replace my pages with the look off keeps the old look's header button, which can lead to a replaced page (a 404)              |
| LINTEL-UX-317   | P3       | Open   | Replace my pages leaves the old template's collections (Episodes, Listings) and their published samples behind                |
| LINTEL-UX-318   | P3       | Open   | Static publishing leaves out the sample 3D models: `/_lintel/models/vase.glb` is a 404 (held by the Rive and 3D track)        |
| LINTEL-UX-319   | P3       | Open   | Lottie and Rive offer Upload a file but no way to pick a file already in Media (held by the Rive and 3D track)                |
| LINTEL-UX-320   | P3       | Open   | Rive's own warning about `stateMachine` is in the console on every page with a Rive animation (held by the Rive and 3D track) |
| LINTEL-UX-321   | P3       | Open   | `InvalidStateError` from the page transition in the console when a page moves to the test payment page. Harmless              |
| LINTEL-UX-322   | P3       | Open   | Insert search for "form" lists about 30 elements, from words in their descriptions; Form is first                             |
| LINTEL-UX-323   | P3       | Open   | The first site is called "Default site" beside the site's own name, and a site at a path says "No domain yet"                 |
| LINTEL-UX-324   | P3       | Open   | A client who types /settings or /build sees those screens (the data is refused); /users shows "This didn't load"              |
| LINTEL-UX-325   | P3       | Open   | Settings → Your website says "Your website is live" on a site with no pages; This server says "sharp works"                   |
| LINTEL-UX-326   | P3       | Open   | An Arc carousel published without pictures is a blank 380px gap                                                               |
| LINTEL-UX-327   | P3       | Open   | Visitors counts goals from automated browsers but not their visits: "form sent 2" beside 0 visitors, a 100% conversion rate   |
| LINTEL-UX-329   | P3       | Open   | During a shop test with the cookie notice showing, the test bar covers the last line of the notice                            |
| LINTEL-UX-328   | P3       | Open   | Templates as drafts with the look on: the first-visit intro and footer show the sample's name on the empty site               |
## Overnight follow-ups (4 November 2026)

On `fix/overnight-followups`; see "Overnight follow-ups" in `FIX-LOG-ux.md`. LINTEL-UX-289 wasn't needed.

| ID            | Severity | Status | Summary                                                                                       |
| ------------- | -------- | ------ | --------------------------------------------------------------------------------------------- |
| LINTEL-UX-270 | P2       | Fixed  | With double opt-in off, the Newsletter form joined people to the list without asking          |
| LINTEL-UX-271 | P2       | Fixed  | The builder's Newsletter element drew no consent box, so a required one stopped every sign-up |
| LINTEL-UX-272 | P3       | Fixed  | The theme's soft grey fell short of AA on tinted paper (fixes LINTEL-UX-157)                  |
| LINTEL-UX-273 | P2       | Fixed  | Brand-coloured labels and numbers could be unreadable with a dark brand in dark mode          |
| LINTEL-UX-274 | P3       | Fixed  | Older templates failed the starter site checks (fixes LINTEL-UX-159)                          |
| LINTEL-UX-275 | P3       | Fixed  | A footer with an unlisted clock zone was silently replaced (fixes LINTEL-UX-158)              |
| LINTEL-UX-276 | P3       | Fixed  | Links on panels and dark footer bands, and Relay's green on its panel, fell short of AA       |
| LINTEL-UX-277 | P2       | Fixed  | With several selected, Copy, Cut, Hide, Lock and dragging acted on one element                |
| LINTEL-UX-278 | P3       | Fixed  | With different kinds selected, Style showed a box's controls                                  |
| LINTEL-UX-279 | P2       | Fixed  | A Rive element set to respond to a click was a button that could have no name or do nothing   |
| LINTEL-UX-280 | P3       | Fixed  | The page weight meter left out three.js and the model file                                    |
| LINTEL-UX-281 | P3       | Fixed  | A model needing Draco uploaded and then never drew                                            |
| LINTEL-UX-282 | P3       | Fixed  | An add-on's details dialog didn't link to its own screen                                      |
| LINTEL-UX-283 | P2       | Fixed  | Personal columns marked under `tables` didn't reach the data map                              |
| LINTEL-UX-284 | P3       | Fixed  | The install review said "Nothing of its own" for tables named only under `personalData`       |
| LINTEL-UX-285 | P3       | Open   | The designer's canvas doesn't show a consent box added to the website's form                  |
| LINTEL-UX-286 | P3       | Open   | The "Open …" link in an add-on's details has no underline until hovered                       |
| LINTEL-UX-287 | P3       | Open   | The docs say an add-on needs no server code, but it can't load without `dist/server.js`       |
| LINTEL-UX-288 | P3       | Open   | Pasting several lands them after the first selected, and only one stays selected              |

Fixed since they were reported above:

- LINTEL-UX-157 is fixed by LINTEL-UX-272.
- LINTEL-UX-158 is fixed by LINTEL-UX-275.
- LINTEL-UX-159 is fixed by LINTEL-UX-274.
