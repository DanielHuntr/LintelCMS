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

- Linux, 8 GB, shared with one fix agent;
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

**Not filed, by instruction:** the other agent's leftovers were seen again and not re-filed: B/I/Link and Ctrl+B in rich text (Ctrl+B in the Body field made no `<strong>`), sidebar Search and Ctrl K contrast (4.45:1 and 2.86:1 on every admin screen in axe), the shopper-facing payments message, and the others in the brief.

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

| ID              | Severity | Status | Defect                                                                                                              |
| --------------- | -------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| LINTEL-SEC-004  | P1       | Fixed  | Anyone with `users:invite` can resend a pending Owner invitation, get the new link and accept it themselves         |
| LINTEL-SEC-005  | P1       | Fixed  | The content tree, recycle bin and SEO routes ignore site limits: a site-A editor can publish or bin site B          |
| LINTEL-SEC-006  | P1       | Fixed  | A code block's CSS can close the page's `<style>` and add a script, even under "remove scripts"                     |
| LINTEL-SEC-007  | P1       | Fixed  | The code HTML cleaner parses differently from browsers; four known inputs keep a working `onerror`/`javascript:`    |
| LINTEL-DATA-007 | P1       | Fixed  | A scheduled publish puts live whatever was saved after scheduling, unchecked and unapproved                         |
| LINTEL-DATA-008 | P1       | Fixed  | A visitor sending a product photo's bytes through a form, then the spam being deleted, deletes the photo            |
| LINTEL-DATA-009 | P1       | Fixed  | A refund whose answer is lost is marked failed although Stripe made it; refunding again pays out twice              |
| LINTEL-DATA-010 | P1       | Fixed  | Autosave sends the parent the editor opened with, quietly moving a page back after a move in the tree               |
| LINTEL-FUNC-014 | P1       | Fixed  | ISK and UGX amounts go to Stripe in the wrong unit: the shopper pays 1% of the price                                |
| LINTEL-FUNC-015 | P1       | Fixed  | A new entry's first autosave swaps the editor component, losing focus and words typed during the save               |
| LINTEL-DATA-011 | P1       | Open   | Rolling back an update restores rows but not the old schema; the old version runs on the new tables                 |
| LINTEL-FUNC-016 | P1       | Open   | On Windows every one-click update after the first fails: renaming a junction over another gives EPERM               |
| LINTEL-SEC-008  | P2       | Fixed  | Any API token, read-only included, can answer workflow approvals for the person who made it                         |
| LINTEL-SEC-009  | P2       | Fixed  | `settings:update` alone can lift its own site limit, limit the Owner role, and change or delete other sites         |
| LINTEL-SEC-010  | P2       | Fixed  | Two-factor can be set up again while on, swapping the authenticator with no password                                |
| LINTEL-SEC-011  | P2       | Fixed  | A passkey can be added without the password, and survives a password reset                                          |
| LINTEL-DATA-012 | P2       | Open   | Binning an entry clears its translations' links for good; restoring doesn't bring them back                         |
| LINTEL-DATA-013 | P2       | Open   | A failed update restores a backup taken before the download, losing orders made while it downloaded                 |
| LINTEL-FUNC-017 | P2       | Open   | Moving a page in the tree doesn't check the new parent is on the same site                                          |
| LINTEL-FUNC-018 | P2       | Open   | Which page is "/" depends on content type names and counts drafts                                                   |
| LINTEL-FUNC-019 | P2       | Open   | A shopper can switch the cart to another market's prices after giving a delivery address                            |
| LINTEL-FUNC-020 | P2       | Open   | Builder: "The visitor leaves the page" animations never play                                                        |
| LINTEL-FUNC-021 | P2       | Open   | Builder: duplicating keeps animation targets pointing at the original's elements                                    |
| LINTEL-FUNC-022 | P2       | Open   | Builder: generated class names can collide (`heading-2`), so styles bleed between elements                          |
| LINTEL-FUNC-023 | P2       | Open   | One element that no longer validates hides the whole designed page on the website                                   |
| LINTEL-FUNC-024 | P2       | Fixed  | Switching workspace tabs or opening preview asks "Leave with unsaved changes?"                                      |
| LINTEL-FUNC-025 | P2       | Open   | Dialogs close when a drag starts inside and ends outside; a new API token's one-time secret is lost                 |
| LINTEL-FUNC-026 | P2       | Open   | Webhooks reuse one time for a whole run: deliveries can be sent twice and signed minutes old                        |
| LINTEL-FUNC-027 | P2       | Open   | The update supervisor doesn't recover from dying mid-switch                                                         |
| LINTEL-FUNC-028 | P1       | Fixed  | Builder: dragging from Insert onto the page does nothing; only Layers takes drops                                   |
| LINTEL-FUNC-029 | P2       | Fixed  | Canvas effects lose their first frame; visitors who ask for less motion see no particles, frost or gradient         |
| LINTEL-SEC-012  | P3       | Open   | Webhook signing secrets are shown to everyone with `settings:read`                                                  |
| LINTEL-SEC-013  | P3       | Open   | No rate limit on the password checks for turning two-factor off and making recovery codes                           |
| LINTEL-SEC-014  | P3       | Open   | Cart tokens are written to the request log (they are in the path, not the query)                                    |
| LINTEL-UX-006   | P1       | Fixed  | A page's Body text vanishes from the website once it has a design; the editor still shows it (redesign)             |
| LINTEL-UX-007   | P1       | Fixed  | Form notifications are on by default but nothing is sent without a mail service, and nothing says so                |
| LINTEL-UX-008   | P1       | Fixed  | New products count stock from 0, so they show "Sold out" while the admin shows "On sale"                            |
| LINTEL-UX-009   | P1       | Fixed  | The shop looks open before it can sell; checkout fails at the last step; no Shop link on the site (redesign)        |
| LINTEL-UX-010   | P1       | Fixed  | Builder: Escape while editing text throws the edit away                                                             |
| LINTEL-UX-011   | P2       | Fixed  | Builder: Publish gives no confirmation and the builder never shows unpublished changes                              |
| LINTEL-UX-012   | P2       | Fixed  | No "View website" link anywhere in the admin                                                                        |
| LINTEL-UX-013   | P2       | Fixed  | Builder spills off the screen at 390px; the tour still runs                                                         |
| LINTEL-UX-014   | P2       | Fixed  | A menu with a link to a deleted page can't be saved, and the error shows the link's id                              |
| LINTEL-UX-015   | P2       | Fixed  | Settings: logo and colour in two places; build-time settings where clients look first; unclear group names          |
| LINTEL-UX-016   | P2       | Fixed  | Account is titled "Create your account"; three other strings show another screen's words                            |
| LINTEL-UX-017   | P2       | Fixed  | Settings is a catch-all: logs, tools and the agency's build settings beside the owner's website details             |
| LINTEL-UX-018   | P2       | Fixed  | The bright violet with lavender tints reads as a generic template, not the intended iOS look                        |
| LINTEL-UX-019   | P2       | Fixed  | Tables capped at 896px with off-centre headings; Users header buttons far from the list; row hover matches the page |
| LINTEL-UX-020   | P2       | Fixed  | The admin looked like any iOS-style app: nothing of its own                                                         |
| LINTEL-UX-021   | P2       | Fixed  | Builder: elements can't be dragged to a new place on the page, only in Layers                                       |
| LINTEL-UX-022   | P2       | Fixed  | Creating a page and opening one show two different editors; sparkle icons; Publish on an empty new page             |

The full UX pass (about 35 findings, each marked small fix or redesign, with screenshots) is in `UX-PASS-batch-3.md`. Redesigns wait for Daniel's approval.

**Tooling found on the way (fixed):** with `core.autocrlf=true` and no `.gitattributes`, a Windows checkout failed `format:check` on 2,617 files and seven test files; the docs test built page addresses with backslashes. A `.gitattributes` now keeps LF everywhere, and the docs test uses forward slashes.
