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

**After:** the ticked rate is sent as soon as rates are offered, and again whenever the choice changes. Browser run: `Subtotal £72.00 Delivery £3.95 Total £75.95` before Pay now.

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
