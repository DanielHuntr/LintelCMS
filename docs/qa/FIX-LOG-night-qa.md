# Fix log: overnight QA and UX pass (`fix/night-qa`)

A first-time website maker's journeys, walked on a fresh install in real Chromium (Playwright 1.63), from `release/1.0.0-rc` at `9943c3c1`. API 4761, website 4762, admin 5761, a new Lintel folder. Each fix was reproduced in the browser first and has a regression test. IDs are in `BUG-REPORT.md`; before and after pictures are in `screenshots/night-qa/`.

## Summary

| ID              | Severity | Commit(s)              | Change in one line                                                                                               |
| --------------- | -------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| LINTEL-FUNC-034 | P1       | `93adda0c`             | A section from the Sections list goes on the page, after the section holding what's selected                     |
| LINTEL-FUNC-033 | P1       | `93adda0c`             | New sections stay above the site's footer                                                                        |
| LINTEL-FUNC-035 | P1       | `ca472bb9`             | The basket total includes delivery as soon as delivery is offered, and follows the choice                        |
| LINTEL-FUNC-031 | P2       | `198ff674`             | Something waiting to slide in no longer makes a published page scroll sideways on a phone                        |
| LINTEL-FUNC-032 | P2       | `b1558334`             | Starting from Blog and magazine switches on the blog, so `/blog` links work, and says so                         |
| LINTEL-UX-302   | P2       | `01a5fa97`             | The standard footer has no "Replace this with your small print" to go live with                                  |
| LINTEL-UX-305   | P2       | `b728d06b`, `4b10df3d` | The product form says what's wrong at the top, in shop words ("on sale", not "active")                           |
| LINTEL-UX-306   | P2       | `62cdc88f`             | The canvas scrolls to what Insert adds                                                                           |
| LINTEL-FUNC-036 | P2       | `4b117c61`             | A destination shows as published when the publish ends; its dates match the rest of the admin                    |
| LINTEL-UX-304   | P2       | `88279843`             | "Market" is now "Where you sell" and "region" in the shop's screens, messages and guides; the API keeps its name |
| LINTEL-UX-315   | P2       | `a73763c2`             | Back from a failed payment, the shopper's email and address are still there (`after-failed-payment.png`)         |
| LINTEL-UX-300   | P3       | `3c3e37b7`             | The template dialog no longer promises to keep pages while replacing them                                        |
| LINTEL-UX-301   | P3       | `3c3e37b7`             | "djs" is "DJs" again on the Longplay card                                                                        |
| LINTEL-UX-303   | P3       | `e348b12f`             | The Make a component dialog doesn't show a colour's code                                                         |
| LINTEL-UX-307   | P3       | `a953c485`             | An A/B test with visitors on one version no longer says "No visitors yet"                                        |
| LINTEL-UX-308   | P3       | `8f94ffcb`             | "646 bytes", not "646 byte"                                                                                      |
| LINTEL-UX-309   | P3       | `b3d40f7f`             | An unreachable app's address gets plain words, not `getaddrinfo ENOTFOUND`                                       |
| LINTEL-UX-310   | P3       | `90cf9f75`             | "Categories and tags" and "Domain and path", not "Taxonomies" and "Hostnames"                                    |
| LINTEL-UX-311   | P3       | `99d3b5c1`             | Someone who can't design isn't offered Use this template, which the API refuses anyway                           |
| LINTEL-UX-312   | P3       | `c8523405`             | A page named after the site reads "Acme", not "Acme \| Acme"                                                     |
| LINTEL-UX-313   | P3       | `e6aa99f3`, `3fec13e2` | The API reference stays inside a phone screen, and is now in the narrow screens run                              |
| LINTEL-UX-314   | P3       | `3fec13e2`             | Updates says "add-ons", as the rest of the admin does                                                            |

---

## Ready-made sections landing in the wrong place (FUNC-033, FUNC-034)

**Before:** pressing a section in Insert went through the rule for single elements: inside whatever is selected, if it can hold it. A section can hold a section, so the section went inside the selected column, squashed to its width (`before-section-inside-column.png`). A section just added stays selected, so the second section of a new page went inside the first. With nothing selected, it went after the site's footer, so the footer sat above it until the page was reopened (`before-footer-above-new-section.png`).

**After:** the Sections list has its own command, `insertSectionTemplate`: on the page, after the top-level section holding the selection, and never below the site's footer. `findInsertPlace` keeps the footer last for elements and pasting too. Dragging to an exact place is unchanged (`after-sections-in-order.png`).

**Tests:** `editor.test.ts`. **Browser:** the layer order checked after each insert on a new page.

## Basket total without delivery (FUNC-035)

**Before:** after Choose delivery the only rate was ticked, but the total stayed at £24.00 until the payment page said £27.95.

**After:** the ticked rate is sent as soon as rates are offered, and again whenever the choice changes. Browser run on a fresh basket, with the site's script rebuilt: `Subtotal £24.00, Delivery £3.95, Total £27.95` before Pay now (`after-basket-total.png`).

**Tests:** `cart-views.test.ts`.

## Sideways scrolling on published pages (FUNC-031)

**Before:** at 390px the Bakery template's Our story page measured 430px wide: a block waiting to slide in from the right stood outside the screen.

**After:** `overflow-x: clip` on the page. It is needed on both `html` and `body`: on the body alone, the setting passes to the window and stops clipping. Sticky headers still work, because clip doesn't make a scrolling box. Measured afterwards: 390px wide, and the page can't be moved sideways.

**Tests:** `chrome.test.tsx`. **Browser:** Bakery `/about`, scrolled to the end.

## The magazine's dead links (FUNC-032)

**Before:** on any site without the blog, Blog and magazine published five links to a 404.

**After:** a template can name `features` it relies on. They are switched on with it for someone with `settings:update`, and the finished note says so. Lind isn't marked: its description says the products appear "when Shop is on", so that stays the site owner's choice.

**Tests:** `starter-sites.test.ts`.

## Plain words

Copy changes are listed in the summary. "Market" stays in the API, its reference and the code; only what people read in the admin and the "using" guides changed.

---

## Second part: production build, open list and what the first part didn't reach

After merging `merge/batch-15`. This part ran the production build (`node dist/main.js`, one port, admin at `/admin`), not the dev servers, on a fresh Lintel folder. That is where the most serious defects were: they cannot be seen on `pnpm dev`.

| ID              | Severity | Commit(s)              | Change in one line                                                                                                         |
| --------------- | -------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| LINTEL-FUNC-041 | P0       | `0441ae60`             | In production, invitations, password resets, email changes and form notices link to the admin under its path               |
| LINTEL-FUNC-042 | P1       | `e08bd6a0`             | The production website now loads the Visitors beacon, reports A/B tests and draws Liquid templates, as the dev one did     |
| LINTEL-FUNC-040 | P1       | `4378a465`, `4f254b7c` | `pnpm lintel` reaches every documented command: `package.json` named the script twice, so most of them failed              |
| LINTEL-FUNC-043 | P1       | `40a9fb14`             | Forms posted from the site's own pages in production are accepted, so a test order can finish                              |
| LINTEL-FUNC-037 | P2       | `d25a05ad`, `ebf6a194` | Translating a page with untranslated parents offers to translate them first; no page becomes a language's home by accident |
| LINTEL-FUNC-038 | P2       | `5605a2d3`             | Templates shows for everyone who can design; only the Owner saw it                                                         |
| LINTEL-FUNC-039 | P2       | `9676059a`             | Admins can run A/B tests                                                                                                   |
| LINTEL-UX-324   | P2       | `f03de222`, `c0d838a6` | Someone typing an address outside their role gets Not available and a way back                                             |
| LINTEL-UX-319   | P2       | `a2c9801b`             | Lottie and Rive elements have Choose from Media, showing only files they can play                                          |
| LINTEL-UX-318   | P2       | `eb17cd47`             | Sample 3D models are copied when a site is published as files                                                              |
| LINTEL-A11Y-039 | P3       | `2f1a8fc2`             | Warning badges (3.90:1) and the own-fonts hint (4.18 to 4.42:1) now pass                                                   |
| LINTEL-UX-316   | P3       | `7516dad7`             | Replace my pages says when a menu or footer link leads to a page that has gone                                             |
| LINTEL-UX-317   | P3       | `7516dad7`             | Replace my pages says which earlier template's collections stayed; they aren't deleted, as they may hold real work         |
| LINTEL-UX-320   | P3       | `218fea19`             | Rive's notes to developers stay out of visitors' consoles                                                                  |
| LINTEL-UX-321   | P3       | `6649aab5`             | The test payment page joins the site's page transition, so it no longer fails on the way in                                |
| LINTEL-UX-322   | P3       | `0ddb5585`             | Insert search matches whole words in descriptions: "form" no longer finds "information"                                    |
| LINTEL-UX-323   | P3       | `6be3a996`             | The first site takes the name chosen at setup; a site at a path shows its path                                             |
| LINTEL-UX-325   | P3       | `41c273f6`             | "Your website’s address", not "Your website is live"; "Pictures can be resized", not "sharp works"                         |
| LINTEL-UX-326   | P3       | `3936dee3`             | An Arc carousel with no pictures is left out instead of leaving a gap                                                      |
| LINTEL-UX-327   | P3       | `c4ab534f`             | A form sent by a robot no longer counts as a Visitors goal                                                                 |
| LINTEL-UX-328   | P3       | `2f1386c2`, `c04ed158` | No first-visit intro on a site with no home page. The sample footer text itself stays: see below                           |
| LINTEL-UX-329   | P3       | `695ada0c`             | The cookie notice sits above the test bar                                                                                  |
| LINTEL-UX-330   | P3       | `ff9933ef`             | "24 visitors this week" no longer squeezes onto three lines in the builder toolbar                                         |
| LINTEL-UX-331   | P3       | `f6f83d94`             | A test with no successes on either side says "about the same", not "B is ahead"                                            |

Tests for UX-321, UX-326 and UX-329 are in `f9c2359f`.

## Why the production defects were missed (FUNC-041, FUNC-042)

Every earlier browser pass, including the first part of this one, used the dev servers. Two things differ in production:

- The admin sits under `/admin`, but emails were built from the origin alone. `server.adminUrl` now holds the whole address. An invitation link led to a 404, so nobody could join a live site, and a forgotten password couldn't be reset from the email.
- The website is wired up twice: `site-server.ts` for dev and `built-in-public-site.ts` for production. The second never got the Visitors tag, the A/B reporting routes or Liquid templates. Nothing failed: the numbers just stayed at zero.

**Recommendation:** make the two share one function, so this can't drift again. I didn't, as it is a refactor.

## A test order that couldn't finish (FUNC-043)

Production pages send `Referrer-Policy: no-referrer`, so a browser marks a form sent from them `Origin: null`, and the cross-site check refused it: Pay (test) showed "Something went wrong". Now `null` passes only with `Sec-Fetch-Site: same-origin`, which a page can't set. A forged request, a sandboxed frame or a request with neither header is still refused. In the browser: test order #1001 placed, with no page errors, which also confirms UX-321.

## Translating a page first (FUNC-037)

The API answers 409 `PARENTS_NOT_TRANSLATED` with the pages needed, top of the tree first, including the site's home page when another top-level page is translated before it. `withParents` starts them all as drafts. The admin asks "Translate the pages above it too?". In the browser: translating Work gave `home` at the top of the French tree and `work` under it.

## Not available (UX-324)

`canOpenPath` in `navigation/sectionAccess.ts`, drawn by `AdminLayout`. The role check below was run in a browser with a real account for each role.

| Role   | Sees in the sidebar                            | Not available by address                           |
| ------ | ---------------------------------------------- | -------------------------------------------------- |
| Admin  | Everything, now with Templates and A/B         | Nothing                                            |
| Editor | Dashboard, Content, Templates, Media, Visitors | Forms, A/B, Shop, Users, Settings, Build           |
| Author | Dashboard, Content, Templates, Media           | Forms, Visitors, A/B, Shop, Users, Settings, Build |
| Viewer | Dashboard, Content, Media                      | Templates and all of the above                     |
| Client | Dashboard, Content, Media                      | Templates and all of the above                     |

Custom roles keep single screens: `backups:read` opens Backups, `privacy:manage` Privacy, `security:read` the Security log.

The first run of this check found FUNC-038 and FUNC-039, and that Build was too open. The table is from the run after those fixes, on the production build.

## Not fixed, on purpose

- **UX-317:** collections from an earlier template are named, not deleted, as someone may have added their own entries.
- **UX-328:** with the look on and pages as drafts, the template's footer still shows its sample name. The look goes live at once by design, and the dialog says so.
