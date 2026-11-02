# Lintel 1.0.0-rc.1: test case inventory

The format follows QA prompt §15. Executed cases carry full steps. Inventory rows that are not yet executed are listed compactly and marked **Not Run**. Results and evidence for executed cases are in TEST-RESULTS.md.

**Legend:**

- **Type:** F = functional, N = negative, E2E = journey, V = visual, R = responsive, A = accessibility, S = security.
- **Pri:** priority of the case, not of any defect.

## Executed in the discovery pass

### TC-SETUP-001: Setup wizard creates an Owner and an online-shop site

- **Module / Pri / Type:** Setup / P0 / E2E
- **Preconditions:** empty `LINTEL_FOLDER`.
- **Steps:**
  1. Open the admin.
  2. Press Get started.
  3. Choose Built-in, then Continue.
  4. Fill in name, email, password and confirm, then Continue.
  5. Enter the site name "QA Shop", then Continue.
  6. Choose Online shop, then Continue.
  7. Tick "I've checked these details".
  8. Press Finish setup.
- **Expected:** a "You're all set" screen; signed in as Owner.
- **Related:** `packages/admin/src/setup/*`.

### TC-BASE-001: Baseline admin screens render without console errors (desktop, light)

- **Module / Pri / Type:** Admin shell / P1 / V
- **Steps:** visit `/`, `/content`, `/settings/content-types`, `/media`, `/commerce`, `/commerce/products`, `/commerce/discounts`, `/settings`, `/users`, `/design`, `/forms`, `/settings/updates`, `/settings/backups`, `/settings/sites`, `/content/navigation`, `/settings/features`, `/commerce/settings`, `/commerce/orders`, `/commerce/customers` at 1440x900.
- **Expected:**
  - an h1 per screen;
  - no page errors;
  - no horizontal scroll.

### TC-BASE-002: Dark mode renders

- **Steps:** emulate `prefers-color-scheme: dark`, then visit `/`, `/content` and `/commerce/products`.
- **Expected:** dark surfaces, legible text, no light-only artefacts.

### TC-RESP-001: Admin is usable at 390px

- **Module / Pri / Type:** Admin shell / P1 / R
- **Steps:** at 390x844 with touch, visit `/`, `/content` and `/commerce/products`, then read `document.documentElement.scrollWidth`.
- **Expected:** `scrollWidth` equals 390; the navigation collapses to a menu.
- **Related:** `packages/admin/src/layout/AdminLayout.tsx`, `Sidebar.tsx`.

### TC-RESP-002: Admin at tablet width (820px)

- **Steps:** visit `/content` at 820x1180.
- **Expected:** no horizontal scroll.

### TC-SHOP-001: Closed basket drawer is hidden on shop pages

- **Module / Pri / Type:** Shop website / P0 / F+V
- **Preconditions:** shop on; an active product `linen-shirt` with GBP price and stock.
- **Steps:**
  1. Open `http://localhost:3730/products/linen-shirt`.
  2. Inspect `dialog.lintel-cart`.
- **Expected:** with `open=false` the dialog is not rendered (`display:none`).
- **Related:** `packages/builder/src/render/elements/element-stylesheet.ts` (`.lintel-cart`).

### TC-SHOP-002: Shopper can press Add to basket

- **Steps:** on the product page, click "Add to basket".
- **Expected:** the click lands; the basket count updates.

### TC-SHOP-003: Basket page shows discount entry and a breakdown that adds up

- **Preconditions:** discount code `SAVE10` (10% off everything); a cart with 2 × £45.00, with `discountCodes:["SAVE10"]` applied through the storefront API.
- **Steps:** open `/cart`.
- **Expected:**
  - a code input is present;
  - a discount line is shown;
  - Subtotal − discount + delivery = Total.

### TC-SHOP-004: Choose delivery lists rates

- **Preconditions:**
  - market GB/GBP;
  - zone UK (GB) with a flat Standard rate of £4.95;
  - the cart from TC-SHOP-003.
- **Steps:**
  1. On `/cart`, fill in Email, Full name, Address, Town or city, Postcode, and Country "GB".
  2. Press Choose delivery.
- **Expected:** a "Delivery" radio list with "Standard, £4.95"; the button becomes "Pay now".
- **Related:** `cart-views.ts:155-178`, `shop-api.ts:152-163`, `core/src/commerce/shipping/shipping-quotes.ts:44`.

### TC-BACKUP-001: Backup includes media bytes and restores

- **Module / Pri / Type:** Backups / P0 / F+N
- **Steps:**
  1. Upload a 7,831-byte PNG through `POST /media`.
  2. `POST /backups`.
  3. Wait for `complete`.
  4. Download it.
  5. List the zip entries.
  6. `GET /backups/:id/restore-preview`.
- **Expected:**
  - the media entry is 7,831 bytes and matches the manifest SHA-256;
  - restore preview succeeds.
- **Related:** `packages/core/src/archives/zip-writer.ts:53-72`.

### TC-CONTENT-001: Child page under an unpublished parent

- **Steps:**
  1. Create Home (draft).
  2. Create "About us" under Home.
  3. Publish About us only.
  4. Fetch `/` and `/about-us` on the website.
- **Expected:** not specified in the guide (logged as SPEC). At minimum, the site's home placeholder text should be accurate.

### TC-CONTENT-002: Published page and the main menu

- **Steps:** after TC-CONTENT-001, `GET /navigation/main`, then view the site header.
- **Expected:** not specified for hand-made pages. The guide only says templates can add pages (SPEC).

### TC-MULTI-001: Site with a path prefix serves its pages

- **Steps:**
  1. `POST /sites` with `{handle:"ie", pathPrefix:"/ie", defaultLocale:"en-IE"}`.
  2. Create and publish "Irish home" on that site.
  3. Fetch `/ie`, `/ie/` and `/ie/irish-home`.
- **Expected:** `/ie` serves the site's home page (the first top-level page).

### TC-SHOPIFY-001: Shopify import of products, customers and orders

- **Steps:**
  1. `POST /shop/imports/shopify` with `core/src/commerce/shopify-import/fixtures/*.csv`.
  2. `POST …/run` until completed.
  3. Check Orders, Customers and the customer detail.
- **Expected:**
  - imported history is visible and consistent;
  - customer order count and spend reflect the import, or the screen says why not.

### TC-UPD-001: Updates screen when the feed is unreachable

- **Steps:** open `/settings/updates` while the feed answers 403.
- **Expected:** one consistent status: "couldn't check", not also "You're up to date".

### TC-BUILDER-001: Header and Footer elements placement

- **Steps:**
  1. Open About us → Design.
  2. Skip the tour.
  3. Add elements → Heading.
  4. Search "Header" and add it.
  5. Search "Footer" and add the first result.
- **Expected:**
  - Header and Footer go to the top and bottom, or replace the site ones;
  - they show the site name, not a placeholder.

### TC-DISC-001: Discounts scoped to collections can be managed

- **Steps:**
  1. Open a discount.
  2. Choose What it's for → Some collections.
  3. Look for a way to create a collection.
- **Expected:** a collection can be created in the admin.

### TC-UNIT-001: Package unit tests (builder, admin)

- **Steps:** `npx vitest run --maxWorkers=2` in `packages/builder` and `packages/admin`.
- **Expected:** all pass.

## Inventory: Not Run (next batches)

| ID             | Module           | Description                                                                                                      | Pri | Type |
| -------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------- | --- | ---- |
| TC-SEC-001     | Permissions      | Editor calls `POST /backups`, `PUT /shop/products/:id`, `POST /sites`, `PUT /sites/access/*` directly → 403      | P0  | S    |
| TC-SEC-002     | Permissions      | Custom role without `builder:code` saves a Code element through the API → refused                                | P1  | S    |
| TC-SEC-003     | Security         | Script in a rich-text field or Code element is stripped on the public page when scripts are not allowed          | P1  | S    |
| TC-SEC-004     | Security         | Cross-site POST with a foreign `Origin` → 403 `CROSS_SITE_REQUEST_REFUSED`                                       | P1  | S    |
| TC-SEC-005     | Uploads          | SVG with script, renamed executable, oversize upload → refused                                                   | P1  | S/N  |
| TC-SEC-006     | Webhooks         | Signature header verifies; failed deliveries retry                                                               | P2  | F    |
| TC-SEC-007     | Setup            | Repeat setup after completion is refused; setup from another machine needs the code                              | P0  | S    |
| TC-EXPORT-001  | Import/export    | Content export with media round-trips to a second install (same `addStream` as DATA-001)                         | P0  | F    |
| TC-BACKUP-002  | Backups          | Restore of a media-free backup succeeds and preserves data                                                       | P0  | F    |
| TC-BACKUP-003  | Backups          | Scheduled backup runs; Admin can view but not create or restore                                                  | P1  | S    |
| TC-CONTENT-003 | Content          | Create, duplicate (with children), move, sort, drag + Undo                                                       | P1  | F    |
| TC-CONTENT-004 | Content          | Schedule publish and unpublish fire at the set time                                                              | P1  | F    |
| TC-CONTENT-005 | Content          | Unsaved-changes prompt on leaving; autosave does not create History entries                                      | P1  | F    |
| TC-CONTENT-006 | Content          | History: keep a named version, restore an earlier one                                                            | P1  | F    |
| TC-CONTENT-007 | Content          | Recycle bin: restore returns a draft in place; Empty asks first; the banner clears after restore                 | P1  | F    |
| TC-CONTENT-008 | Content          | Duplicate slug, circular move, disallowed child type → refused with field-level messages                         | P1  | N    |
| TC-CONTENT-009 | Content          | Moving a live page offers redirects; the redirect works on the site                                              | P2  | F    |
| TC-CONTENT-010 | Collections      | Table/grid views, filters, bulk Publish/Unpublish/Move/Delete                                                    | P2  | F    |
| TC-MODEL-001   | Content types    | Change a field type/handle on a type with published entries → no silent data loss (Scenario D)                   | P0  | DATA |
| TC-MODEL-002   | Fieldsets        | Fieldset in use cannot be deleted; a change propagates to every type                                             | P1  | F    |
| TC-MODEL-003   | Conditions       | Hidden values kept/cleared according to the setting                                                              | P1  | F    |
| TC-MODEL-004   | Model as code    | `lintel model diff` and two-way sync                                                                             | P2  | F    |
| TC-BUILDER-002 | Builder          | Text toolbar Bold/Italic/Link; Ctrl+B; Ctrl+Z with various focus                                                 | P1  | F/A  |
| TC-BUILDER-003 | Builder          | Responsive styles per breakpoint with the "Changed for phones" chip                                              | P2  | F    |
| TC-BUILDER-004 | Builder          | Free layout: snapping, Alt, arrow nudge, Mod+[ and Mod+]                                                         | P2  | F    |
| TC-BUILDER-005 | Builder          | Animation preset + reduced motion on the public page                                                             | P2  | F/A  |
| TC-BUILDER-006 | Builder          | Form element previews the chosen form                                                                            | P2  | F    |
| TC-BUILDER-007 | Builder          | Collection list binds fields; publish → public page                                                              | P1  | E2E  |
| TC-SHOP-005    | Shop             | Sandbox checkout → order created → stock decremented → fulfil → partial refund                                   | P0  | E2E  |
| TC-SHOP-006    | Shop             | Sitemap includes `/shop` and product pages                                                                       | P2  | F    |
| TC-SHOP-007    | Shop             | Country pickers have no duplicate or retired ISO codes                                                           | P3  | F    |
| TC-SHOP-008    | Shop             | Shop off → no repeated 404 log noise                                                                             | P3  | F    |
| TC-FORMS-001   | Forms            | Submit; honeypot/too-fast/rate limit; CSV export                                                                 | P1  | F/S  |
| TC-MEDIA-001   | Media            | Upload, alt text saves on blur, focal point, delete in-use file                                                  | P1  | F    |
| TC-USERS-001   | Users            | Invite, change role, disable sign-in, invitation link                                                            | P1  | F    |
| TC-ACCOUNT-001 | Account          | 2FA, passkeys, password reset link expiry (30 min)                                                               | P1  | S    |
| TC-BRAND-001   | Branding         | Name/logo/colour in sidebar, sign-in, tab title, emails; no over-replacement                                     | P2  | V    |
| TC-AUTO-001    | Automations      | Trigger on publish → email/webhook; approval blocks publish                                                      | P2  | F    |
| TC-API-001     | APIs             | REST/GraphQL delivery with a scoped token; token shown once                                                      | P1  | F/S  |
| TC-WP-001      | WordPress import | Import report states why posts were skipped                                                                      | P2  | F    |
| TC-CLI-001     | CLI              | `lintel --version`, `create-admin`, `reset-password`                                                             | P2  | F    |
| TC-E2E-A       | Journey          | Scenario A, agency client site                                                                                   | P0  | E2E  |
| TC-E2E-B       | Journey          | Scenario B, limited editor                                                                                       | P0  | E2E  |
| TC-E2E-C       | Journey          | Scenario C, online shop                                                                                          | P0  | E2E  |
| TC-E2E-D       | Journey          | Scenario D, content model evolution                                                                              | P0  | E2E  |
| TC-E2E-E       | Journey          | Scenario E, two editors (expect a SPEC gap)                                                                      | P1  | E2E  |
| TC-A11Y-001    | Accessibility    | axe scan + keyboard pass: tree, builder, dialogs, product editor; contrast of sidebar Search and the Ctrl K hint | P1  | A    |
| TC-PERF-001    | Performance      | Tree with 2,000 pages; collection with 10,000 entries; builder page with 300 elements                            | P2  | PERF |
