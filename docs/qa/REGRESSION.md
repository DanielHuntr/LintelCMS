# Lintel 1.0.0-rc.1: regression coverage

## Baseline (2 Nov 2026, `66b6b9b`)

| Suite                                                                        | Command                                                | Result                                                     |
| ---------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------- |
| builder unit                                                                 | `cd packages/builder && npx vitest run --maxWorkers=2` | 18 files, 192 tests: **Pass**                              |
| admin unit                                                                   | `cd packages/admin && npx vitest run --maxWorkers=2`   | 103 files, 562 tests: **Pass**                             |
| core unit/integration                                                        | –                                                      | **Not Run** (time box)                                     |
| motion, motion-editor, builder-model, site-components, cli, field-conditions | –                                                      | **Not Run**                                                |
| `admin/journeys/*.mjs`                                                       | –                                                      | **Not Run** (needs a production build and a fresh install) |
| lint / typecheck / format:check                                              | –                                                      | **Not Run**                                                |

All suites that were run are green, while P0 defects are open. Green unit tests are therefore not evidence of release quality here.

## Regression checks to add with each fix

Each item should become an automated test when its defect is fixed. Do not mark a fix Verified without both the test and a browser re-check.

| Defect             | Guard to add                                                                                                                                            | Where                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| DATA-001           | Write a non-empty stream with `ZipWriter.addStream`, read it back, compare bytes and SHA-256. Then do a backup → restore round trip with one media file | `core/src/archives`, `core/src/backups` |
| DATA-001 (sibling) | Content export with media round-trips                                                                                                                   | `core/src/content-transfer`             |
| FUNC-001           | Rendered page CSS: a closed `dialog.lintel-cart` computes `display:none` (browser test)                                                                 | `builder` browser tests                 |
| FUNC-002           | Contract test: `ShippingRate` on the site matches the storefront OpenAPI `shippingQuote` schema                                                         | `builder/src/site-behaviours`           |
| FUNC-003           | Basket view renders `discounts[]` and a code field; totals reconcile                                                                                    | `builder`                               |
| FUNC-004           | The site server serves a path-prefix site on the default host                                                                                           | `core/src/website`                      |
| UX-001             | Playwright: `scrollWidth <= clientWidth` at 390px on `/`, `/content` and `/commerce/products`                                                           | new admin browser check                 |
| FUNC-005           | Inserting Header or Footer places it first or last                                                                                                      | `builder-model`                         |
| FUNC-006           | Updates page with a failed check doesn't render the up-to-date card                                                                                     | `admin/src/updates`                     |

## "Working well" items from the prior review: re-verify after fixes

- setup wizard (passed this pass);
- tree drag + Undo;
- recycle bin;
- field picker;
- live conditions;
- field widths;
- media alt text;
- autosave/History;
- builder empty state and tour;
- Insert grouping;
- shop admin wording;
- discount API maths (the cart API total of £81.00 for 10% off £90.00 is correct);
- forms spam protection;
- Editor 403s;
- branding;
- dashboard layout persistence.

---

## Batch 2 (2 Nov 2026, `73e47a2`)

### Suites

SUITES_TABLE_PLACEHOLDER

### Regression checks to add with the batch 2 fixes

| Defect | Guard to add | Where |
| --- | --- | --- |
| SEC-001 | Someone with `settings:read` but not Owner gets 403 from `GET /email/outbox`, or sees no `#token=` in any message not addressed to them | `core/src/email` |
| DATA-003 | Rename a field handle on a type with entries: values move to the new handle (entries and the open revision), and `data.<old>` bindings in page designs are updated; or the change is refused with a count | `core/src/blueprints`, `core/src/fieldsets` |
| DATA-004 | The entry editor's save sends only changed fields; a stale save gets 409 with the other person's name | `admin` entry editor, `core/src/entries` |
| DATA-005 | Adding conditions to a field with values: the response warns, or the default keeps the values for existing entries | `core/src/blueprints`, `field-conditions` |
| FUNC-008 | A type change or removed choice reports the affected entries before it is saved | `core/src/blueprints` |
| FUNC-009 | Rich text nested deeper than the limit is refused with a field message; GET never 500s on stored content | `core/src/fieldtypes/rich-text.ts` |
| SEC-002 | `/search` honours site access (mirror the `content-tree/search` test) | `core/src/search` |
| A11Y-001/002 | Browser test: closing the basket drawer returns focus to its opener; after Choose delivery, focus is on the Delivery group | `builder` browser tests |
| A11Y-003 | Playwright: `scrollWidth <= 320` at 320px on an entry and a content type (extend `e2e/narrow-screens.e2e.mjs`) | `admin/e2e` |

### Batch 2 re-checks of earlier guards

- The batch 2 security matrix (`screenshots/batch-2/logs/matrix.md`) should be rerun after any change to `requirePermission` or roles. It is a quick API script; consider turning it into a core integration test that walks every registered route.
- **Still green:** the discovery-pass items "Editor 403s" and "forms spam protection" (batch 2 TC-SEC-001, TC-FORMS-001).
