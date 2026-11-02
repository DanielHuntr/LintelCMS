# Lintel 1.0.0-rc.1: release readiness

**Assessment date:** 2 Nov 2026. **Commit:** `66b6b9b` (`release/1.0.0-rc`). **Phase:** discovery (QA prompt §22).

## Decision: **NOT READY**

Three P0 defects are reproduced with evidence:

- backups can't be restored once any media exists;
- the website shop cannot take an order (drawer overlay and checkout TypeError).

Separately, coverage is still too thin to support a READY decision even after these are fixed (see Untested).

## Criteria

| Item                      | Status                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| Critical workflows tested | Setup ✔; website purchase ✘; backup/restore ✘; multisite path ✘; content publish (partial) |
| Passed tests              | 6                                                                                          |
| Failed tests              | 13                                                                                         |
| Blocked tests             | 0                                                                                          |
| Not Run                   | 48 inventory cases + most prior "should fix" leads                                         |
| Open P0                   | 3: LINTEL-DATA-001, LINTEL-FUNC-001, LINTEL-FUNC-002                                       |
| Open P1                   | 3: LINTEL-FUNC-003, LINTEL-UX-001, LINTEL-FUNC-004                                         |
| Open P2 / P3              | 6 / 3                                                                                      |

## Risks

**Security:**

- Not assessed in this pass: permissions, XSS, uploads, CSRF, tokens and webhooks are all Not Run.
- The prior review reports Editor 403s working; this was not re-verified.

**Data integrity:**

- DATA-001: backups are silently unrestorable.
- Content export probably has the same fault (not run).
- Scenario D (content model changes against published content) is not run.

**Accessibility:**

- Reflow fails at 390px (UX-001).
- Contrast and keyboard checks are not run.

**Visual:**

- The website shop pages look broken (FUNC-001).
- The builder produces duplicate headers and footers (FUNC-005).
- Otherwise the admin is consistent and restrained (see DESIGN-BASELINE.md).

**Performance:** not measured.

**Regression:**

- builder and admin unit suites are green;
- core and the other packages, the journeys, lint and typecheck were not run.

## Known limitations of this assessment

- Everything ran in dev mode (tsx watch + Vite), not a production build.
- Built-in database only.
- Outbound internet is blocked, so update and remote-image behaviour wasn't tested.
- Shopify import was run through the API with the repository fixtures, not the admin wizard.
- Several repros used the API to seed state. The user-visible results were checked in the browser.

## Next steps

1. Fix the three P0s, adding the regression guards listed in REGRESSION.md.
2. Re-run TC-SHOP-001–004 and TC-BACKUP-001 in a browser.
3. Run TC-SEC-001…007 and TC-EXPORT-001.
4. Run Scenarios A–D end to end (TEST-CASES.md).
5. Run the core test suite, lint and typecheck.
6. Reassess. CONDITIONALLY READY is possible only once the P1s are fixed or explicitly accepted by the owner.

---

# Batch 2 reassessment (2 Nov 2026, `73e47a2`, after 15 fixes)

## Decision: **NOT READY**

The fixes from the first round removed the three discovery P0s (FIX-LOG-shop.md, FIX-LOG-site.md; not re-verified here beyond the incidental checks in TEST-RESULTS.md). Batch 2 found a new release blocker and two P1 data-loss defects:

- **LINTEL-SEC-001 (P0):** on any install without `EMAIL_DRIVER` (the default), anyone with "See settings", including every Admin, can read the Owner's password-reset link in the email outbox and become Owner. This was reproduced end to end.
- **LINTEL-DATA-003 (P1):** renaming a field handle breaks published pages at once, and deletes values as entries are saved.
- **LINTEL-DATA-004 (P1):** two people editing one entry silently lose each other's saved changes.

## Criteria (batch 2)

| Item                                 | Status                                                                                                                                                                                                                      |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Critical workflows tested in batch 2 | Permissions ✔ (one hole); CSRF ✔; sessions ✔; tokens ✔; uploads ✔; webhooks ✔; XSS ✔; multisite isolation (search ✘); content model evolution ✘; two editors ✘; negative cases (mostly ✔); keyboard checkout ✘ (focus loss) |
| Passed / Failed / Blocked            | 15 / 14 / 5 sub-steps (TEST-RESULTS.md, batch 2)                                                                                                                                                                            |
| Open P0                              | 1: LINTEL-SEC-001                                                                                                                                                                                                           |
| Open P1                              | 2: LINTEL-DATA-003, LINTEL-DATA-004                                                                                                                                                                                         |
| Open P2 / P3 (batch 2)               | 8 / 15                                                                                                                                                                                                                      |
| Discovery P0/P1s                     | Fixed per the fix logs; one P0 (FUNC-002) verified only up to the payment hand-off (no Stripe without internet)                                                                                                             |

## Risks

- **Security:**
  - SEC-001 (account takeover).
  - SEC-002 (other sites' titles in search).
  - SEC-003 (old scripts survive the switch to "remove scripts").
  - Everything else tried held: the role matrix, owner-only gates, CSRF, session invalidation, rate limits, token scopes, the SSRF guard, signatures, upload checks, XSS escaping and site isolation on routes.
  - Not tested: DNS-based SSRF at send time, two-factor, passkeys, time-based expiry.
- **Data integrity:**
  - DATA-003, DATA-004, DATA-005 and FUNC-008 together mean content-model changes and concurrent editing are unsafe on a live site.
  - Some values are recoverable from History, entry by entry.
- **Accessibility:**
  - Focus is lost in the website's basket drawer and checkout.
  - The admin editors don't reflow at 320px.
  - Name/label mismatches.
  - Remaining contrast issues outside the sidebar.
  - Reduced motion and most touch targets passed.
- **Visual:** double status badges, and long titles overflowing narrow layouts.
- **Performance:** not measured. A 5,000-paragraph page rendered in about 0.7 s.
- **Regression:** see REGRESSION.md, batch 2.

## What would change the decision

1. Fix SEC-001 (Owner-only outbox, or masked tokens) and add its guard.
2. Fix DATA-003 and DATA-004, or accept them explicitly with a documented workaround ("don't rename handles on live sites"; "one editor per entry").
3. Rerun TC-SEC-001b, TC-MODEL-001/002 and TC-E2E-E.
4. Run the `admin/e2e` journeys and a production build.
5. Then **CONDITIONALLY READY** is reasonable if the P2s are accepted.
