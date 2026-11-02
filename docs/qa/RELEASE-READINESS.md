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
