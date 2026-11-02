# Lintel 1.0.0-rc.1: QA test plan

Status: discovery phase (QA prompt section 22). Written 2 Nov 2026 against `release/1.0.0-rc` at `66b6b9b`, branch `qa/discovery`.

## Scope

- **Specification:** the 1.0.0-rc.1 feature guide (what is documented as built and working). Where the guide is silent, the gap is logged as `SPEC` rather than assumed.
- **In scope for this pass:**
  - read-only discovery;
  - baseline screens;
  - reproducing the prior review's must-fix leads;
  - test inventory;
  - a prioritised plan.
- **Out of scope for this pass:**
  - product code fixes;
  - refactors;
  - design-token changes;
  - load and performance measurement;
  - Postgres;
  - S3;
  - Docker and production builds;
  - one-click updates (outbound internet is blocked).

## Environment

| Item        | Value                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------- |
| OS          | Linux, 2 CPUs, 8 GB RAM                                                                                       |
| Node / pnpm | 22.23.4 / 10.28.0                                                                                             |
| API         | `packages/core` `pnpm dev` (tsx watch), port 4730                                                             |
| Website     | built-in site server, port 3730                                                                               |
| Admin       | Vite dev server, port 5730, `VITE_API_URL=http://localhost:4730`                                              |
| Data        | `LINTEL_FOLDER=/tmp/qa-data`, built-in database (PGlite)                                                      |
| Browser     | Playwright 1.63, Chromium 1243 headless, `--disable-dev-shm-usage`, one worker                                |
| Viewports   | 1440x900 (desktop), 820x1180 (tablet), 390x844 (phone, touch)                                                 |
| Network     | outbound internet blocked: update feed answers 403, Shopify image downloads fail (environmental, not defects) |

**Environment observations (not product defects):**

- The renderer crashed ("Page crashed") after about 15 navigations in a single tab against the Vite dev server. Using a fresh browser context per screen avoided it. Re-check this against a production build before treating it as a product issue.
- As PRIOR-REVIEW notes, a second instance needs per-package start commands, because `vite.config.ts` defaults to port 5173 and turbo `dev` doesn't pass every variable through.

## Existing automated coverage (discovered)

| Package                                                  | Unit/integration test files | Notes                                                                                                                                                                                         |
| -------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| core                                                     | 145                         | Includes `commerce.e2e.test.ts`, which runs the full sale journey through Fastify `inject` with faked Stripe. It never renders the website, so it cannot catch FUNC-001, FUNC-002 or FUNC-003 |
| admin                                                    | 103                         | Vitest + jsdom. `e2e/field-conditions.e2e.mjs`. `journeys/*.mjs` are real-Chromium journeys, run manually on a fresh install and not part of `pnpm test`                                      |
| builder                                                  | 20                          | Vitest; also a `vitest.browser.config.ts`                                                                                                                                                     |
| motion / motion-editor / builder-model / site-components | 13 / 5 / 10 / 7             |                                                                                                                                                                                               |
| cli / field-conditions / plugin-example-bookings / docs  | 4 / 1 / 1 / 2               |                                                                                                                                                                                               |

**Weak or missing coverage found:**

1. **No browser test of the public shop pages.** The website cart and checkout scripts (`builder/src/site-behaviours/cart-views.ts`, `shop-api.ts`) are not exercised against the real storefront API shape. That is how FUNC-002 (the `price` vs `amount` mismatch) shipped.
2. **No backup round trip with real media.** A backup containing a media file is never restored in tests (DATA-001).
3. **No responsive admin checks.** Nothing asserts the absence of horizontal overflow at phone widths.
4. **No path-prefix multisite rendering test** on the site server (FUNC-004).
5. **The journeys are not in CI.** They need a fresh install, so they don't guard regressions.

## Strategy and priorities

Risk-ranked. Higher rows run first in the next batches.

| Rank | Area                                             | Why                                                | Planned approach                                                            |
| ---- | ------------------------------------------------ | -------------------------------------------------- | --------------------------------------------------------------------------- |
| 1    | Backups / restore / content export               | Silent data loss (DATA-001 confirmed)              | Round-trip with media, then a `content-export` check (same `addStream`)     |
| 2    | Shop on the website: basket, checkout, discounts | Revenue path broken (FUNC-001, FUNC-002, FUNC-003) | Real-browser journey with a seeded cart, after fixes                        |
| 3    | Permissions (server-side)                        | Security                                           | API calls as an Editor and as a custom role against every write route group |
| 4    | Multisite and path prefixes                      | Pages unreachable (FUNC-004)                       | Site-server routing with a hostname and a path                              |
| 5    | Content publish, unpublish, tree and menus       | Core editor workflow                               | Scenario A/B in a browser                                                   |
| 6    | Content model evolution (Scenario D)             | Data loss risk on field changes                    | API + browser                                                               |
| 7    | Builder: insert, undo, text formatting, publish  | Main differentiator                                | Browser, Designer level                                                     |
| 8    | Responsive admin                                 | Unusable on phones (UX-001)                        | Overflow assertions at 390/820                                              |
| 9    | Concurrency (Scenario E)                         | No conflict handling is specified                  | Two contexts; log as SPEC if absent                                         |
| 10   | Accessibility                                    | WCAG 2.2 AA                                        | axe scan plus a manual keyboard pass on the tree, builder and dialogs       |

**Batching:**

- Each batch is about 5–8 related cases.
- After each batch:
  - record results in TEST-RESULTS.md;
  - record defects in BUG-REPORT.md;
  - add regression notes to REGRESSION.md.

## Tools and evidence

- Ad-hoc Playwright and Node scripts were run from `/tmp/qa-scripts` and are not committed. They used the admin's own `playwright` dependency.
- Screenshots are in `docs/qa/screenshots/` as 256-colour PNGs.
- Unit tests are run per package with `vitest run --maxWorkers=2`.

## Entry and exit criteria for the next phase

- **Entry:**
  - P0 fixes are merged on `release/1.0.0-rc`;
  - a fresh `/tmp/qa-data`.
- **Exit to READY:**
  - no open P0 or P1;
  - ranks 1–5 executed with Pass;
  - the regression checklist in REGRESSION.md is green.
