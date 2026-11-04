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

---

# Release candidate verdict (4 November 2026, `60c5010`, after the fix batches)

## Decision: **CONDITIONALLY READY** as the next release candidate (1.0.0-rc.x)

No P0 is open. Every security, data, shop, builder, content tree and accessibility defect in the fix logs is fixed, each with a regression test that fails without it. The full run is clean apart from the known Windows failures (TEST-RESULTS.md, 4 November 2026).

Two P1s are still open, and both are in one-click updates. They don't touch content, the website or the shop day to day, but they can hurt a live site at the moment it updates. So the condition is about updates: either fix them, or accept them for this candidate and say plainly that one-click updates aren't safe yet.

This is a verdict on the release candidate only. Whether and when to call anything 1.0 is Daniel's decision, and nothing here makes it.

## What is still open

From BUG-REPORT.md, with the batch 3 status column and the fix logs.

**P0:** none.

**P1 (2, both blocking one-click updates):**

- **LINTEL-DATA-011:** rolling back an update puts the rows back but not the old schema, so the old version runs on the new tables. A rollback is the moment someone is already in trouble, and this can make it worse.
- **LINTEL-FUNC-016:** on Windows, every one-click update after the first fails with EPERM when a junction is renamed over another. Windows sites can update once and then can't.

**P2 (5):**

- **LINTEL-DATA-013:** a failed update restores a backup taken before the download, so orders placed during the download are lost. Not blocking alone, but it belongs with the two P1s.
- **LINTEL-FUNC-027:** the update supervisor doesn't recover if it dies mid-switch. Same area.
- **LINTEL-FUNC-018 (part):** "/" no longer depends on content type names, but a draft Home still holds "/". Waiting for Daniel's decision.
- **LINTEL-UX-014 (part):** adding Shop to the menu now drops a link to a deleted page, but the menu editor itself still shows the error with the link's id.
- **LINTEL-DATA-003 (what's left):** renamed handles now move values, except for fields inside groups, repeaters or blocks, fieldsets inside those or in global sets, and `data.<old>` bindings in page designs, which still need changing by hand. The batch 2 entry has no status column, so this is recorded here.

**P3 (2):**

- **LINTEL-UX-005:** an empty .png is refused as "looks like a .png file", and a safe SVG with an outside link is called "damaged".
- **LINTEL-SPEC-005:** the guide's role examples ("design pages", "manage updates") have no matching permission, and Admin carries `orders:*` and `automations:*`, which aren't in the catalogue.

**Not filed as defects, still worth tracking:** the ten designer-test findings (FIX-LOG-ux.md), the dark-mode text swatch in the style panel, and the admin's delivery-rate form, which wasn't checked in a browser after FUNC-012.

## Criteria

| Item                       | Status                                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------- |
| Format, lint, typecheck    | Pass                                                                                            |
| Production build           | Pass (12 of 12 tasks)                                                                           |
| Package tests              | 2,413 passed, 25 failed, 5 skipped; all 25 are the known Windows failures; nothing new or flaky |
| Regression tests for fixes | One per fix, failing without it (fix logs); TEST-CASES.md batch 4 maps each fix to its test     |
| Manual and browser checks  | Done per fix in the fix logs, at desktop and 390px, light and dark; not repeated in this pass   |
| Open P0                    | 0                                                                                               |
| Open P1                    | 2: LINTEL-DATA-011, LINTEL-FUNC-016                                                             |
| Open P2 / P3               | 5 / 2                                                                                           |

## Risks

- **Security:** every filed security defect is fixed, SEC-001 to SEC-014. Still not tested by hand: DNS-based SSRF at send time and session expiry by time.
- **Data integrity:** the content-model and two-editor losses are fixed (DATA-003, DATA-004, DATA-005, FUNC-008). What's left is the DATA-003 gaps above and the update path (DATA-011, DATA-013).
- **Updates:** the weakest area. Its tests can't run on Windows, so this run says nothing about it either way.
- **Shop:** paying has only been checked against a faked Stripe. No real payment has gone through in any pass.
- **Accessibility:** A11Y-001 to A11Y-007 are fixed. Still not done: screen-reader testing and real browser zoom.
- **Performance:** not measured beyond the 5,000-paragraph page in batch 2.

## What would make it READY as a release candidate

1. Fix DATA-011 and FUNC-016, or accept them for this candidate in writing, with one-click updates marked as not safe yet and the manual update steps in the guide.
2. Run the update tests on Linux (CI) and confirm them green.
3. Run the `admin/e2e` journeys against a production build.

## What a 1.0 decision still needs

This is Daniel's call. Before it can be made:

1. The update P1s and P2s fixed, not just accepted (DATA-011, FUNC-016, DATA-013, FUNC-027), and a real update and rollback tried on Linux and Windows.
2. Daniel's decision on FUNC-018 (does a draft Home keep "/"?).
3. The DATA-003 gaps closed, or written up as a known limit.
4. A real payment, refund and webhook round trip with Stripe in test mode.
5. A manual pass over the batch 4 cases in TEST-CASES.md in a browser.
6. A screen-reader pass on the admin's everyday screens and on checkout.

## Update, 4 November 2026: the update defects are fixed

Branch `fix/update-blockers` (`FIX-LOG-updates.md`, decision 0041). The text above is
unchanged; this note supersedes the update items in it.

- **LINTEL-FUNC-016 (P1), fixed:** on Windows the old `current` junction is removed
  before the new one is renamed in. A switch cut off in between is finished on the next
  start.
- **LINTEL-DATA-011 (P1), fixed:** the supervisor copies the built-in database while the
  site is paused, and a failed update or a roll back puts that exact copy back, tables and
  rows. A roll back across database changes needs the copy and is refused without it. On a
  Postgres server, updates that change the database are refused before anything stops.
- **LINTEL-DATA-013 (P2), fixed:** that copy is taken at the switch, after the download.
- **LINTEL-FUNC-027 (P2), fixed:** a switch journal lets a restarted supervisor finish or
  undo a half-done switch.
- **Windows test runs:** the update, supervisor, release-signature, install-type, main,
  dev-runtime and model-sync tests now pass on Windows. Core has no failures left on
  Windows; two CLI path tests still fail there.

With these, **no P1 is open**. Still needed before calling one-click updates safe:

- a real update and roll back of a release build, on Linux and on Windows;
- the update tests on Linux in CI;
- a decision on Postgres: updates that change the database are done by hand for now.

## Update, 4 November 2026: independent review of the night's work

Branch `fix/night-review` (`FIX-LOG-night-review.md`). The text above is unchanged.

- Two P1s are fixed: LINTEL-CODE-017 (an add-on's Delete data could empty Lintel's own tables) and LINTEL-CODE-018 (the PHP companion lost delayed payments). Sites published with the companion must add `checkout.session.async_payment_succeeded` to their Stripe webhook.
- Seven decisions are left for Daniel, listed in the fix log. The one to look at first: finding a person by name treats two people with the same name as one, and erases both.

## Update, 4 November 2026: overnight QA and UX pass

Branch `fix/night-qa` (`FIX-LOG-night-qa.md`). The text above is unchanged.

- A first-time website maker's journeys were walked in a real browser, from nothing to a published site, a test shop order, forms, privacy, creative pages and static publishing. 22 defects were fixed: 3 P1, 8 P2, 11 P3.
- The three P1s were everyday flows that automated tests didn't reach: where a section lands in the builder (FUNC-033, FUNC-034) and a basket total without delivery (FUNC-035).
- **Open:** 1 P2 (FUNC-037, translating a page before its parent, for Daniel to decide) and 14 P3. No P0 or P1 is open from this pass.
- **Not covered:** a real payment, a real add-on or app install, FTP, SFTP and S3 publishing, WebKit and Firefox, a screen reader, contrast measurement. See `TEST-RESULTS.md`.

## Update, 4 November 2026: the production build

`FIX-LOG-night-qa.md`, "Second part". The earlier note on this pass said no P0 or P1 was open; that was true of what had been tested, which was the dev servers only.

- Running the production build found one P0 and three P1s, all fixed: emailed admin links led to a 404 (FUNC-041), Visitors, A/B reporting and Liquid templates didn't work on the live website (FUNC-042), a form from the site's own page was refused (FUNC-043), and most `pnpm lintel` commands failed (FUNC-040).
- **Open from this pass:** 3 P3s (UX-332, UX-333, UX-334), and the sample footer text in UX-328.
- **Lesson:** browser passes should run on a production build. Several earlier "pass" results were only true on `pnpm dev`.
- **Still not covered:** Firefox (not installed), the full journeys in WebKit, a real payment, FTP, SFTP and S3 publishing, a screen reader, and contrast of text over pictures.

## Overnight follow-ups (4 November 2026)

LINTEL-UX-270 to 284 are fixed on `fix/overnight-followups`, and LINTEL-UX-157, 158 and 159 with them. LINTEL-UX-285 to 288 are open, all P3. No P1 was added.

## Update, 4 November 2026: the review's decisions are built

Branch `fix/night-review` (`FIX-LOG-night-review.md`, LINTEL-CODE-030 to 037). The text above is unchanged.

- All seven decisions are built, along with reaching what published websites keep from Find a person and erase.
- Sites published with the companion need publishing once more, for the new private files' names and the two privacy actions.
- An upgraded site now keeps everything until its owner chooses retention rules.

## Update, 4 November 2026: working together

Branch `feature/collaboration` (`FIX-LOG-collaboration.md`, LINTEL-UX-350 to 379). The text above is unchanged.

- Saves to pages, A/B versions, and the navigation and footer can no longer overwrite someone else's without asking.
- Blocks, menus, global settings, forms and media still save the last change.
- Not yet checked in Firefox or Safari, on real Passenger hosting, or with more than three people.
