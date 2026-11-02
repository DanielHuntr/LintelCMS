# Lintel 1.0.0-rc.1: test results

**Run:** discovery pass, 2 Nov 2026. Commit `66b6b9b`; environment as in TEST-PLAN.md. Only cases that were actually executed are marked Pass or Fail.

## Summary

| Result  | Count                           |
| ------- | ------------------------------- |
| Pass    | 6                               |
| Fail    | 13                              |
| Blocked | 0                               |
| Not Run | 48 (inventory in TEST-CASES.md) |

## Executed cases

| Test ID               | Result                       | Evidence                                                                                                                                                                                          | Defect                                                     |
| --------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| TC-SETUP-001          | **Pass**                     | `screenshots/00-setup-database.png` … `03-setup-done.png`. The Online shop choice creates no market; the shop home's checklist covers that, so it is not filed                                    | –                                                          |
| TC-BASE-001           | **Pass** (render)            | 19 screens at 1440x900, all with an h1, no page errors, no console errors, `scrollWidth`=1440. See `screenshots/10-…28-*.png`                                                                     | Content findings filed separately                          |
| TC-BASE-002           | **Pass**                     | `30-content-dark.png`, `31-products-dark.png`, `32-dashboard-dark.png`                                                                                                                            | –                                                          |
| TC-RESP-001           | **Fail**                     | `scrollWidth` at a 390 viewport: Dashboard 511, Content 724, Products 614. `40-42-mobile-*.png`                                                                                                   | LINTEL-UX-001                                              |
| TC-RESP-002           | **Pass**                     | Content at 820px: `scrollWidth` 820. `43-tablet-content.png`                                                                                                                                      | –                                                          |
| TC-SHOP-001           | **Fail**                     | `dialog.lintel-cart`: `{"open":false,"display":"flex","rect":[1056,177,384,900]}`. `50-site-product-page.png`                                                                                     | LINTEL-FUNC-001                                            |
| TC-SHOP-002           | **Fail**                     | `locator.click: Timeout 4000ms exceeded … waiting for element to be visible, enabled and stable` on "Add to basket"; this was still the case after forcing the dialog's display off               | LINTEL-FUNC-001 (cause of the second timeout not isolated) |
| TC-SHOP-003           | **Fail**                     | Cart PATCH `{discountCodes:["SAVE10"]}` → 200. The page shows "Subtotal £90.00 / Total £81.00", with no discount line and no code input. `54-site-cart-with-items.png`                            | LINTEL-FUNC-003                                            |
| TC-SHOP-004           | **Fail**                     | After Choose delivery: "Cannot read properties of undefined (reading 'amount')". `55-site-choose-delivery-error.png`                                                                              | LINTEL-FUNC-002, UX-003, VIS-001                           |
| TC-BACKUP-001         | **Fail**                     | See the log below                                                                                                                                                                                 | LINTEL-DATA-001                                            |
| TC-CONTENT-001        | **Fail** (copy) / SPEC       | `/about-us` 200 while its parent Home is a draft. `/` shows "This website is ready for its first page…"                                                                                           | LINTEL-SPEC-001                                            |
| TC-CONTENT-002        | **Fail** / SPEC              | `GET /navigation/main` → `itemCount: 0`. `65-menu-main.png`                                                                                                                                       | LINTEL-SPEC-002                                            |
| TC-MULTI-001          | **Fail**                     | `/ie` 404, `/ie/` 404, `/ie/irish-home` 404. Site match → 404 `SITE_NOT_FOUND`                                                                                                                    | LINTEL-FUNC-004                                            |
| TC-SHOPIFY-001        | **Fail**                     | Report: products 2 created / 2 skipped; customers 2 created / 1 failed (no email); orders 2 created. `GET /shop/orders` total 0; customers `orderCount 0`, `totalSpent []`. `60-customer-ada.png` | LINTEL-DATA-002                                            |
| TC-UPD-001            | **Fail**                     | `21-updates.png`                                                                                                                                                                                  | LINTEL-FUNC-006                                            |
| TC-BUILDER-001        | **Fail**                     | Canvas text: "QA Shop / Heading / Your site / Menu / … Explore About Contact Follow Newsletter / QA Shop © 2026 QA Shop". `71-builder-header-footer.png`                                          | LINTEL-FUNC-005                                            |
| TC-DISC-001           | **Fail** (code + navigation) | No collections route in `commerceRoutes.tsx`. `67-discount-collections-scope.png`                                                                                                                 | LINTEL-FUNC-007                                            |
| TC-UNIT-001 (builder) | **Pass**                     | `vitest run --maxWorkers=2`: 18 files, 192 tests passed                                                                                                                                           | –                                                          |
| TC-UNIT-001 (admin)   | **Pass**                     | `vitest run --maxWorkers=2`: 103 files, 562 tests passed                                                                                                                                          | –                                                          |

The unit suites are green while three P0 defects are present. They don't cover the website cart scripts against the real API shape, a backup round trip with media, or path-prefix routing.

## TC-BACKUP-001 log

```
POST /media (test.png, 7831 bytes) -> 201 {"id":"9abb56cd-…","size":7831,…}
POST /backups -> 201 {"status":"running",…}
GET  /backups -> 92f36e7d-… complete 19351
zip entries:  media/default/9abb56cd-6e12-47fb-beb9-9bc8d4e5935b.png  file_size=0  compress_size=2
manifest.json files[]: {"path":"media/default/9abb56cd-….png","size":7831,"sha256":"11c464f0…"}
GET /backups/92f36e7d-…/restore-preview -> 400 {"code":"BACKUP_DAMAGED","message":"This backup is damaged: media/default/9abb56cd-….png isn't what it was when the backup was made. Nothing was changed. Try another copy of the backup."}
```

## TC-MULTI-001 log

```
POST /sites {"handle":"ie","name":"Ireland","pathPrefix":"/ie","defaultLocale":"en-IE"} -> 201
POST /collections/pages/entries (site ie) "Irish home" -> 201; POST /entries/:id/publish -> 200
GET /sites -> default "" 2 entries; ie "/ie" 1 entry
GET http://localhost:3730/ie        -> 404 Page not found | QA Shop
GET http://localhost:3730/ie/irish-home -> 404
GET /delivery/sites/match?url=http://localhost:3730/ie/irish-home -> 404 SITE_NOT_FOUND
```

## Prior-review leads not executed in this pass (Not Run)

**"Should fix" leads:**

- Builder:
  - text toolbar Bold/Italic/Link and Ctrl+B;
  - complexity switches;
  - Ctrl+Z focus;
  - breadcrumb siblings;
  - Insert search for shape/free layout;
  - Form element preview;
  - phone footer width.
- Saving and content:
  - validation "Couldn't save";
  - recycle-bin banner;
  - content type editor Save buttons;
  - Body vs Design.
- Shop:
  - country picker duplicates;
  - Stripe raw errors;
  - localhost webhook URL;
  - shopper-facing admin message;
  - test payments;
  - Tax screen vs overview;
  - "From £" pricing;
  - sitemap shop pages;
  - SEO settings;
  - Store details.
- Leftovers:
  - roadmap placeholders;
  - white-label over-replacement;
  - backup progress;
  - WordPress import reasons;
  - Shopify mapping density;
  - product editor alt text and duplicate variant labels;
  - dashboard widgets;
  - shop-off 404 log noise.

**"Nice to have" leads:** contrast figures, favicon, setup review tick, condition summary text, double "Saved" announcement.

**"Working well" items:** not re-verified in this pass. Each was observed only incidentally: the setup wizard passed, and Dashboard Edit was not exercised.

## Environment notes

- The update feed returned 403 and Shopify image downloads failed ("fetch failed"). Both are caused by blocked outbound internet, and neither is filed.
- Chromium "Page crashed" after about 15 navigations in one tab (Vite dev server). Re-check this against a production build before filing.
