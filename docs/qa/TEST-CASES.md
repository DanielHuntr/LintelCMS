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

## Batch 2 (2 Nov 2026, `73e47a2`): security, Scenarios D and E, negative cases, accessibility

These cases were executed against the API directly (Node `fetch` with real session cookies or API tokens) and in Chromium. The environment is in BUG-REPORT.md under "Batch 2". The inventory rows TC-SEC-001…007, TC-MODEL-001…003, TC-CONTENT-008, TC-FORMS-001 (partly), TC-API-001, TC-E2E-D, TC-E2E-E and TC-A11Y-001 are now covered by the cases below. Results are in TEST-RESULTS.md.

### Security and permissions (prompt §13)

| ID          | Pri / Type | Preconditions                                                                                 | Steps                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Expected                                                                                                                                                                    |
| ----------- | ---------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TC-SEC-001  | P0 / S     | Users for Owner, Admin, Editor, Viewer and the custom role "Writer QA"; no session for "anon" | Call 50 routes for each user, covering content, publish, delete, content types, fieldsets, page script setting, users, roles, invitations, backups (list, create, schedule, restore), updates (view, install, rollback), settings (website, SEO, plugins), API tokens, webhooks, security log, outbox, export and import, sites and site access, shop (products, orders, refunds, settings, payments), forms, globals, menus, media upload, recycle bin, dashboard role layouts, branding and GraphQL (`logs/matrix.md`) | anon 401 everywhere except public GraphQL; every role is refused (403) exactly where its permissions don't cover the route; owner-only routes give 403 OWNERS_ONLY to Admin |
| TC-SEC-001b | P0 / S     | as above                                                                                      | Admin or "Settings reader": `GET /email/outbox` after a signed-out `POST /auth/forgot-password` for the Owner; use the link                                                                                                                                                                                                                                                                                                                                                                                              | Reset links for other people aren't readable                                                                                                                                |
| TC-SEC-002  | P1 / S     | Editor and custom role (no `builder:code`)                                                    | Save a page design containing a `codeBlock`, by create and by PATCH                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 400 "only people allowed to edit code…"                                                                                                                                     |
| TC-SEC-003  | P1 / S     | Editor                                                                                        | Save `<img onerror>` and `<script>` in Title, Summary, rich-text Body (with a `javascript:` link), SEO title and description, heading and paragraph elements, a form submission, a product title and a media filename. Publish. Fetch the site pages, and open the entry, tree, media, form submissions, products and Ctrl K search in the admin with a `dialog` listener                                                                                                                                                | Escaped everywhere; no dialog; `javascript:` links lose their address; `javascript:` button links refused                                                                   |
| TC-SEC-003b | P2 / S     | Owner                                                                                         | With scripts removed, save a Code element with `<script>`, `onmouseover`, `javascript:`, `svg onload` and `iframe srcdoc`; then check a page saved while scripts were allowed                                                                                                                                                                                                                                                                                                                                            | Cleaned on save; old pages follow the current rule                                                                                                                          |
| TC-SEC-004  | P1 / S     | Editor session                                                                                | POST to create a page with Origin `evil.example`, `null`, the website's origin, another admin port, the admin and the API; with no Origin and `Sec-Fetch-Site` cross-site, same-site, same-origin or absent; a `text/plain` body; a form-encoded sign-out from another origin; CORS preflight                                                                                                                                                                                                                            | Foreign origins and cross/same-site fetches 403 `CROSS_SITE_REQUEST_REFUSED`; CORS allows only the admin                                                                    |
| TC-SEC-005  | P1 / S     | Editor                                                                                        | Upload: valid PNG; HTML renamed .png; .html; ELF renamed .jpg; PNG named .exe; SVGs with script, onload, `javascript:`, foreignObject, XXE and an external `<use>`; a safe SVG; traversal names (`../../`, `..\`); an XSS filename; a 300-character name; a 0-byte file; 26 MB; a PNG with HTML appended. Read each back                                                                                                                                                                                                 | Unsafe types refused; names sanitised; no write outside the media folder; served with `nosniff`, a sandboxing CSP and the right type                                        |
| TC-SEC-006  | P2 / F     | Owner                                                                                         | Webhooks to localhost, 127.0.0.1, `[::1]`, 169.254.169.254, 10/8, 192.168/16, 0.0.0.0, decimal/hex/short IPv4, `[::ffff:127.0.0.1]`, `*.localhost`, `file:`, `gopher:`; PATCH an allowed hook to 127.0.0.1. With `WEBHOOKS_ALLOW_PRIVATE_ADDRESSES=true` and a local receiver, verify `Lintel-Signature` with the HMAC; check that retries are scheduled for a failing target; post to the Stripe webhook unsigned and with a bad signature                                                                              | Private targets refused on save and on send; signature verifies with the secret only; failures retried; unsigned Stripe events refused                                      |
| TC-SEC-006b | P2 / S     | Owner, Admin                                                                                  | Read back API tokens, webhooks, Stripe and PayPal settings after saving secrets                                                                                                                                                                                                                                                                                                                                                                                                                                          | Secrets not echoed (webhook signing secret excepted, by design)                                                                                                             |
| TC-SEC-007  | P0 / S     | Setup finished                                                                                | `POST /setup/finish` again                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 409 SETUP_ALREADY_DONE                                                                                                                                                      |
| TC-SEC-008  | P1 / S     | Sessions                                                                                      | Set-Cookie flags; replay a cookie after sign-out; deactivate a signed-in user; reactivate; change a role mid-session (both ways); a garbage cookie; reset the password while another session is open; reuse a reset token; forgot-password for an unknown email; more than 10 sign-ins a minute                                                                                                                                                                                                                          | HttpOnly, SameSite=Lax; sessions end server-side on sign-out, deactivation and reset; role changes apply at once; token single-use; the same answer for unknown emails; 429 |
| TC-SEC-009  | P1 / S     | Read and read-write API tokens                                                                | Call content, drafts, delivery, media, create, publish, users, tokens, outbox, backups, blueprints, orders, account and webhooks with each token (with a foreign Origin); revoke; bogus token                                                                                                                                                                                                                                                                                                                            | Read: published content and model only; read-write adds entries and media; nothing else; revoked/bogus 401                                                                  |
| TC-SEC-010  | P1 / S     | Site `ie` (`/ie`); Editor limited to `default`                                                | As Editor, list, get, patch, publish, revisions, create (query and header), duplicate, copy-to-site, delete, tree, tree search and global search for `ie` content; fetch `/ie`, `/ie/irish-home`, `/irish-home` and `/ie/irish-draft`                                                                                                                                                                                                                                                                                    | Everything about `ie` refused or empty; site paths isolated                                                                                                                 |

### Scenario D: content model evolution (prompt §6)

| ID            | Pri / Type | Steps                                                                                                                                                                                                                                                                                                                                                                                                                                              | Expected                                                                   |
| ------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| TC-MODEL-001  | P0 / DATA  | Type "Service" + collection `services` + 3 published entries + a published page "Our services" whose collection list binds `title`, `data.tagline`, `data.badge`, `data.price` and `data.category`. Then: (A) rename handle `tagline`→`strapline`; (B) Number→Text; (C) remove a used choice; (D) delete a field, then re-add it. After each step, read entries, delivery and the site, re-save one entry with only a title change, and read again | No silent loss; a warning or migration before any data becomes unreachable |
| TC-MODEL-002  | P1 / F     | Fieldset `cta` used by Service: rename `cta_label`→`cta_text`, re-save an entry; then try to delete the fieldset                                                                                                                                                                                                                                                                                                                                   | Values kept or moved; delete refused while in use                          |
| TC-MODEL-003  | P1 / F     | Add "Show when Featured is on" to Tagline (default keepHiddenValues); re-save an entry with Featured off; publish                                                                                                                                                                                                                                                                                                                                  | Existing values aren't cleared without a warning                           |
| TC-MODEL-004b | P2 / F     | Make Tagline required; save and publish an entry without one                                                                                                                                                                                                                                                                                                                                                                                       | Save allowed as a draft; publish refused with a field message              |

### Scenario E: two editors (prompt §6)

| ID       | Pri / Type | Steps                                                                                                                                                                                                                                                                                                   | Expected                                                          |
| -------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| TC-E2E-E | P1 / E2E   | API: A PATCHes summary, B PATCHes title from a stale view; same field both ways; send `If-Match`. Browser: Editor (A) and Owner (B) open "Shared page"; A edits Summary and saves; B edits Title and saves; reload both; then both edit Summary and save in order; inspect the PATCH bodies and History | Not specified (SPEC-004). Recorded: overwrites, warnings, history |

### Negative and edge cases (prompt §7)

| ID             | Pri / Type | Steps                                                                                                                                                                                                                | Expected                                                                                                                    |
| -------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| TC-CONTENT-008 | P1 / N     | Duplicate slug (sibling, other parent, PATCH); unicode and `../` slugs; circular moves by PATCH and tree move; self-parent; a page under a Service; a Service with a parent; a missing parent                        | Refused with field-level messages; slugs cleaned                                                                            |
| TC-NEG-001     | P2 / N     | A 10,000-character title; 300; a 1,000-character slug; a 2 MB summary; whitespace-only title; unknown field; 5,000-paragraph rich text; 2,000-level nesting; malformed JSON. Render what was saved                   | Sensible limits; nothing that saves can break reading                                                                       |
| TC-NEG-002     | P2 / N     | 3 simultaneous publishes; 2 simultaneous creates with the same slug                                                                                                                                                  | No duplicates; one create refused                                                                                           |
| TC-NEG-003     | P1 / N     | Refresh with an unsaved edit in the entry editor                                                                                                                                                                     | "Leave without saving?" (beforeunload)                                                                                      |
| TC-FORMS-001   | P1 / F/S   | Contact form: submit at once (too fast), normally, an identical duplicate, with honeypot, without or with a forged token, over the rate limit; export CSV with an `=HYPERLINK` value and HTML                        | Too-fast and honeypot dropped silently; tokens required; rate limited; duplicate handling recorded; CSV formula-neutralised |
| TC-IMPORT-001  | P1 / N     | Content import: 60% of a zip, minus the last 22 bytes, bytes flipped, 0 bytes, intact; count pages before and after. WordPress: half an XML file; a full import, with core restarted right after Start, then resumed | Friendly refusals; nothing partly imported; a resumed import doesn't duplicate                                              |

### Accessibility (prompt §11)

| ID          | Pri / Type | Steps                                                                                                                                                                                                                                                                                                                         | Expected                                                                                 |
| ----------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| TC-A11Y-001 | P1 / A     | axe (WCAG 2.0–2.2 A/AA tags) on `/content`, the entry editor, the content type editor, the field picker dialog, the builder, the website product page and `/cart`                                                                                                                                                             | No serious violations (excluding the sidebar contrast leftover)                          |
| TC-A11Y-002 | P1 / A     | Keyboard only: Tab order on `/content`; arrows, Home, End and Enter in the tree; Tab order in the editor; field picker by Enter, typing, arrows, 40 Tabs and Escape; builder Tab order and Insert → Heading by keyboard; product → Add to basket → drawer → Escape; `/cart` → details → Choose delivery → rate by Space → Pay | Logical order, visible focus, focus kept in dialogs and returned on close, no lost focus |
| TC-A11Y-003 | P1 / A     | Viewports 720x450 (200% of 1440) and 320x256 (400% of 1280): `/content`, the entry editor, the content type editor, `/our-services`, `/products/linen-shirt`, `/cart`                                                                                                                                                         | No horizontal scroll (WCAG 1.4.10)                                                       |
| TC-A11Y-004 | P2 / A     | `reducedMotion: reduce`: open the field picker; load `/our-services`; list elements with animations over 10 ms or transitions over 200 ms                                                                                                                                                                                     | None                                                                                     |
| TC-A11Y-005 | P2 / A     | 390x844 touch: list interactive elements under 24x24 px on `/content` (menu open), the entry editor, `/cart` and the product page                                                                                                                                                                                             | None (WCAG 2.5.8)                                                                        |
