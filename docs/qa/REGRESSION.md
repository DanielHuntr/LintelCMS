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
