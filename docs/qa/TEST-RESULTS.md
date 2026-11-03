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

---

# Batch 2 results (2 Nov 2026, `73e47a2`, branch `qa/batch-2`)

Environment as in BUG-REPORT.md under "Batch 2". Every case below was run in this batch; nothing is marked Pass from code reading. Logs are in `screenshots/batch-2/logs/`, and screenshots are in `screenshots/batch-2/`.

## Summary (batch 2)

| Result              | Count                                                                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pass                | 15                                                                                                                                                    |
| Fail                | 14                                                                                                                                                    |
| Blocked (sub-steps) | 5: session expiry by time, the webhook DNS check at send, a signed Stripe event, interrupting a WordPress import mid-run, setup from another computer |
| Package suites      | see "Automated suites" below                                                                                                                          |

## Executed cases

| Test ID        | Result                                   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Defect                       |
| -------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| TC-SEC-001     | **Pass**                                 | 50 routes x 5 users. anon 401 on all but public GraphQL. Editor/custom/Viewer 403 exactly outside their permissions. Admin 403 OWNERS_ONLY on role change of self, update install and rollback, and 403 on backup create, schedule and restore; 403 CANNOT_GRANT_PERMISSION inviting an Owner. One 500 seen (FUNC-010). `logs/matrix.md`                                                                                                                                      | FUNC-010                     |
| TC-SEC-001b    | **Fail**                                 | Admin and "Settings reader" read the Owner's reset link from `/email/outbox`, reset the password (204) and signed in with `["*"]`; `POST /backups` 202. `logs/sec-escalation.log`                                                                                                                                                                                                                                                                                             | **SEC-001 (P0)**             |
| TC-SEC-002     | **Pass**                                 | Editor and Writer QA: 400 "only people allowed to edit code…" on create and PATCH. `logs/sec-xss.log`                                                                                                                                                                                                                                                                                                                                                                         | –                            |
| TC-SEC-003     | **Pass**                                 | Site: payloads escaped in `<title>`, meta description, `og:title`, headings, text and prose; `javascript:` rich-text link rendered `href=""`; `javascript:`/` JaVaScRiPt:`/`java\tscript:` button links refused (400). Admin: 0 injected `<img src=x>`, 0 dialogs on 6 screens (`sec-xss-*.png`)                                                                                                                                                                              | –                            |
| TC-SEC-003b    | **Fail** (P3)                            | `removeScripts` strips `<script>`, `on*`, `javascript:` and `srcdoc` on save (`<div>x</div><a>l</a><svg></svg><iframe></iframe>`), but a page saved under `allowScripts` keeps serving `<script>`                                                                                                                                                                                                                                                                             | SEC-003                      |
| TC-SEC-004     | **Pass**                                 | evil/null/site/other-port Origins 403; same-site and cross-site `Sec-Fetch-Site` 403; same-origin and no headers 201; form-encoded 415; CORS answers only the admin origin. `logs/sec-csrf.log`                                                                                                                                                                                                                                                                               | –                            |
| TC-SEC-005     | **Pass**                                 | Spoofed types 415; 5 unsafe SVGs 422; 26 MB 413; traversal names cleaned (`qa2-pwn2.png`), nothing written outside; files served with `nosniff` and `CSP default-src 'none'`. Messages for the empty file and `<use>` are confusing. `logs/sec-uploads.log`                                                                                                                                                                                                                   | UX-005                       |
| TC-SEC-006     | **Pass** (DNS step Blocked)              | 13 private and odd targets 400 PRIVATE_WEBHOOK_ADDRESS; `file:`/`gopher:` 400; PATCH to 127.0.0.1 400; HMAC verified, wrong secret and tampered body don't match; failed deliveries `pending` with `nextAttemptAt`; Stripe webhook 409 without a signing secret. Names resolving to private IPs at send time (`localtest.me`) couldn't be checked: no DNS here. `logs/sec-webhooks.log`                                                                                       | –                            |
| TC-SEC-006b    | **Pass**                                 | API tokens and the PayPal/Stripe read-backs show no secrets; the webhook signing secret is returned to `settings:read`, by design. Saving Stripe keys is Blocked (Stripe unreachable, 502)                                                                                                                                                                                                                                                                                    | –                            |
| TC-SEC-007     | **Pass**                                 | Repeat `POST /setup/finish` → 409 SETUP_ALREADY_DONE. The "setup code from another computer" case was Not Run                                                                                                                                                                                                                                                                                                                                                                 | –                            |
| TC-SEC-008     | **Pass** (time expiry Blocked)           | `HttpOnly; SameSite=Lax; Expires` +30 days; sign-out, deactivation and password reset end sessions (401); reactivation doesn't revive them; role changes apply on the next request; reset token single-use; unknown email 202; sign-in 429 after 10/min; forgot-password 429. `logs/sec-session.log`                                                                                                                                                                          | –                            |
| TC-SEC-009     | **Pass**                                 | Read token: delivery + media + model only (no drafts); read-write: entries and media; neither reaches users, tokens, outbox, backups, blueprints, orders, webhooks or account. Revoked/bogus 401 INVALID_API_TOKEN. `logs/sec-tokens.log`                                                                                                                                                                                                                                     | –                            |
| TC-SEC-010     | **Fail**                                 | 12 of 13 routes refused or isolated; `/search?q=Irish` returned the other site's draft title. Site paths isolated. `logs/sec-multisite.log`                                                                                                                                                                                                                                                                                                                                   | SEC-002                      |
| TC-MODEL-001   | **Fail**                                 | (A) handle rename: values gone from the site at once and deleted on re-save; (B)/(C) entries unsaveable; (D) delete then re-add: values kept (pass). `logs/scenD.log`, `scenD-site-listing.png`, `scenD-service2-after-rename.png`                                                                                                                                                                                                                                            | DATA-003, FUNC-008, FUNC-013 |
| TC-MODEL-002   | **Fail**                                 | Fieldset field rename: "Go 1" lost on re-save. Deleting an in-use fieldset: 409 FIELDSET_IN_USE (pass)                                                                                                                                                                                                                                                                                                                                                                        | DATA-003                     |
| TC-MODEL-003   | **Fail**                                 | Condition added → Service 3's tagline null after a title-only save                                                                                                                                                                                                                                                                                                                                                                                                            | DATA-005                     |
| TC-MODEL-004b  | **Pass**                                 | Publish refused with `strapline: "Tagline is required"` (NOT_READY_TO_PUBLISH)                                                                                                                                                                                                                                                                                                                                                                                                | –                            |
| TC-E2E-E       | **Fail** / SPEC                          | API merges per field (different fields kept; same field last write wins; `If-Match` ignored). Browser: B's save sent every field and reverted A's summary; no warning; History keeps both. `logs/scenE.log`, `scenE-*.png`                                                                                                                                                                                                                                                    | DATA-004, SPEC-004           |
| TC-CONTENT-008 | **Pass**                                 | Duplicate slug 400 (also under another parent: SPEC-003); circular and self-parent 400; placement 400 PLACEMENT_NOT_ALLOWED; missing parent 400; `Ünïcode Slug!` → `unicode-slug`; `../../etc` → `etc`. Tree move with a wrong body gave a schema message (`index`)                                                                                                                                                                                                           | SPEC-003                     |
| TC-NEG-001     | **Fail**                                 | 10,000-character title accepted; 1,000-character slug 400; 2 MB 413; whitespace title 400; unknown field dropped; 5,000 paragraphs render in 697 ms; 2,000-level nesting saves then 500s; malformed JSON 400. `logs/negative.log`                                                                                                                                                                                                                                             | FUNC-009, UX-004             |
| TC-NEG-002     | **Pass**                                 | 3 publishes all 200, no duplicates; 2 creates with the same slug: 201 + 400                                                                                                                                                                                                                                                                                                                                                                                                   | –                            |
| TC-NEG-003     | **Pass**                                 | Reload with an unsaved Summary raised `beforeunload`                                                                                                                                                                                                                                                                                                                                                                                                                          | –                            |
| TC-FORMS-001   | **Fail** (P3)                            | Too fast → 201 and nothing stored; honeypot → 201 and nothing stored; missing or forged token 400 FORM_EXPIRED; 429 TOO_MANY_SUBMISSIONS; CSV prefixes `'=` and `'+`. An identical duplicate was stored twice. `logs/forms.log`                                                                                                                                                                                                                                               | DATA-006                     |
| TC-IMPORT-001  | **Fail** (P3); mid-run interrupt Blocked | Truncated/empty: 400 with clear messages; bit-flipped: 500; page count 21 → 21. WordPress half-XML: 400 NOT_A_WORDPRESS_EXPORT. The fixture import completed before core could be restarted, so resuming wasn't exercised (resume of a finished import: 409 IMPORT_FINISHED)                                                                                                                                                                                                  | FUNC-011                     |
| TC-A11Y-001    | **Fail**                                 | Website product page and `/cart`: no violations. Admin: `label-content-name-mismatch` on every screen; field picker contrast 3.15:1; builder 4.41:1 (plus the excluded sidebar contrast). `logs/a11y-1.log`, `a11y-2.log`, `a11y-5.log`                                                                                                                                                                                                                                       | A11Y-004, A11Y-005           |
| TC-A11Y-002    | **Fail**                                 | Pass: skip link first, then a logical order; tree arrows expand and move, Enter opens, visible ring (`a11y-tree-focus.png`); editor order Title → address → tabs → fields → bottom bar; the field picker opens on Enter with focus in the search box, and Escape returns focus to "Add field" (Tab leaves to the document after the last control, as with a native modal); builder top bar → panels, and Insert → "Heading" by keyboard. Fail: drawer and checkout lose focus | A11Y-001, A11Y-002, A11Y-006 |
| TC-A11Y-003    | **Fail**                                 | 720px: only `/content` overflows (long title). 320px: entry 402, content type 389, `/content` 95,998; the website fits                                                                                                                                                                                                                                                                                                                                                        | A11Y-003, UX-004             |
| TC-A11Y-004    | **Pass**                                 | With reduced motion: 0 long animations or transitions in the field picker and on `/our-services` (no animation preset was on that page, so presets weren't checked)                                                                                                                                                                                                                                                                                                           | –                            |
| TC-A11Y-005    | **Fail** (P3)                            | 390 touch: `/content`, `/cart` and the product page have none under 24px; the entry editor has 2                                                                                                                                                                                                                                                                                                                                                                              | A11Y-007                     |

## Discovery-pass "working well" items touched again in batch 2

- **Editor 403s:** re-verified with a wider matrix (TC-SEC-001).
- **Forms spam protection:** re-verified (TC-FORMS-001).
- **Field picker:** keyboard re-verified (TC-A11Y-002).
- **Tree keyboard:** verified. Drag + Undo was not repeated.
- **LINTEL-FUNC-002 and FUNC-003 (fixed):** the basket showed the Discount code field and a delivery rate list after Choose delivery (`a11y-checkout-keyboard.png`). Not a full re-verification.
- **LINTEL-FUNC-004 (fixed):** `/ie` and `/ie/irish-home` answered 200 (TC-SEC-010).

## Automated suites (batch 2)

Run per package with `npx vitest run --maxWorkers=2`, one after another, with no dev servers running. Raw output is in `logs/suites.log`.

SUITES_PLACEHOLDER

## Not covered in batch 2

- The journeys in `packages/admin/e2e` (see the suites section for what was run).
- Screen-reader testing (no assistive technology in the sandbox). Real browser zoom was emulated with viewport sizes.
- Animation presets with reduced motion on a published page.
- Builder accessibility beyond the top bar, Insert and axe (canvas selection, Layers drag alternatives, free layout).
- Performance (TC-PERF-001).
- Session expiry by elapsed time (30-day cookie; no clock control), two-factor and passkeys.
- Whether a restricted editor sees other sites' drafts in the dashboard's "Drafts needing attention" widget.

---

# Full run (4 November 2026, `release/1.0.0-rc` at `60c5010`, branch `docs/qa-verdict`)

A full run of the repository's own checks after the fixes in the fix logs, from a clean worktree with a fresh `pnpm install`. No manual cases were run in this pass. The new cases in TEST-CASES.md (batch 4) are covered here only through their regression tests.

**Environment:** Windows 11, Node 22, pnpm 10.28.0; the built-in database in tests. Other dev servers were running on the same machine, so it was under some load.

## Commands

Run one after another from the repository root:

| Command                | Result                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| `pnpm format:check`    | Pass: "All matched files use Prettier code style!"                                             |
| `pnpm lint`            | Pass: no errors, no warnings                                                                   |
| `pnpm typecheck`       | Pass: 21 of 21 tasks                                                                           |
| `pnpm build`           | Pass: 12 of 12 tasks                                                                           |
| `pnpm test --continue` | 19 of 21 tasks pass; `@lintel/core` and `@lintel/cli` fail, on the known Windows failures only |

## Test counts per package

| Package                           | Files                    | Tests                                  |
| --------------------------------- | ------------------------ | -------------------------------------- |
| `@lintel/admin`                   | 126 passed               | 660 passed                             |
| `@lintel/core`                    | 152 passed, 7 failed     | 1,001 passed, 22 failed, 5 skipped     |
| `@lintel/builder` (unit)          | 26 passed                | 248 passed                             |
| `@lintel/builder` (browser)       | 7 passed                 | 21 passed                              |
| `@lintel/builder-model`           | 13 passed                | 169 passed                             |
| `@lintel/motion` (unit)           | 15 passed                | 133 passed                             |
| `@lintel/motion` (browser)        | 3 passed                 | 38 passed                              |
| `@lintel/motion-editor` (unit)    | 4 passed                 | 25 passed                              |
| `@lintel/motion-editor` (browser) | 1 passed                 | 3 passed                               |
| `@lintel/site-components`         | 7 passed                 | 35 passed                              |
| `@lintel/field-conditions`        | 1 passed                 | 17 passed                              |
| `@lintel/docs`                    | 2 passed                 | 11 passed                              |
| `@lintel/plugin-example-bookings` | 1 passed                 | 6 passed                               |
| `starter-nextjs`                  | 3 passed                 | 19 passed                              |
| `@lintel/cli`                     | 2 passed, 2 failed       | 27 passed, 3 failed                    |
| **All**                           | **363 passed, 9 failed** | **2,413 passed, 25 failed, 5 skipped** |

## Known failures (Windows only; not counted against the release)

All 25 failures are the known Windows ones. CI runs on Linux and doesn't see them. None is new.

**Core (22):**

- `updates/updates.test.ts`: 9 of 9. `tar -czf C:\…` fails with "tar (child): Cannot connect to C: resolve failed": `tar` reads the drive letter as a remote host.
- `updates/supervisor/supervisor.test.ts`: 5 of 8, the same `tar` cause.
- `updates/release-signature.test.ts`: 4 of 8, the same `tar` cause.
- `updates/install-type.test.ts`: 1 of 3. "expected 'process' to be 'source'": installs are told apart by POSIX paths.
- `main.test.ts`: 1 of 1. "Test timed out in 120000ms": the start-up test spawns processes in a way that assumes Linux.
- `dev-runtime/dev-runtime.test.ts`: 1 of 1. "spawn …\node_modules\.bin\tsx ENOENT".
- `content-model-sync/model-sync.test.ts`: 1 of 12. Paths come back as `content-types\post.ts` instead of `content-types/post.ts`.

**CLI (3):**

- `command-line.test.ts`: 1 of 11. "expected 'C:\home\ana\site\backups\site.zip' to be '/home/ana/site/backups/site.zip'".
- `commands/model.test.ts`: 2 of 6. "loads without failing whether or not core has the commands" timed out at 5000ms; "reads the same settings and defaults as the server" failed on paths.

## Flaky tests

None failed in this run. Admin `router.test`, `HelpLauncher.test` and core `roles.test` all passed, so nothing needed a re-run on its own.

## New or unexpected failures

None.

## Compared with the last recorded runs

- Admin: 660 tests, up from 600 (FIX-LOG-security.md). Builder-model 169, up from 150. Builder 248 unit and 21 browser, up from 207 and 10.
- Core: 1,001 passed, up from 959. Failures went from 23 to 22: `plugin-system.test.ts` now passes (LEFT-008).
- CLI: unchanged at 27 passed, 3 failed.

## What this run doesn't show

- No manual or browser pass over the fixed screens. Each fix log records its own browser checks and screenshots.
- The `admin/e2e` journeys were not run.
- The update tests can't run on Windows, so this run neither confirms nor rules out the open update defects (DATA-011, FUNC-016, DATA-013, FUNC-027).
- Paying through Stripe is still covered only by the faked Stripe in `commerce.e2e.test.ts`.
