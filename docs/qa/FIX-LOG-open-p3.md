# Fix log: the remaining small open items (`fix/open-p3`)

4 November 2026, on `fix/open-p3` from `3fdf6aa1`. Each item was reproduced first, by a test against the old code or in a browser, and has a regression test. New IDs follow LINTEL-UX-334.

**Environment:** Windows 11, Node 24, Chromium through Playwright, the built-in database in a scratch folder. Browser checks used the dev servers on ports 4781, 4782 and 5781, then the production build on 4781.

## Summary

| ID              | Severity | Outcome                                                                                                            |
| --------------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| LINTEL-UX-332   | P3       | The website is wired up once, in `addWebsiteRoutes`, for development and production. A test stops the two drifting |
| LINTEL-UX-334   | P3       | An app's sidebar page shows only for the roles it is meant for                                                     |
| LINTEL-UX-333   | P3       | A client's canvas shows no column guides                                                                           |
| LINTEL-UX-288   | P3       | Several pasted elements land in order after the last selected, and all stay selected                               |
| LINTEL-UX-285   | P3       | The designer's canvas shows the consent box the website adds to a form                                             |
| LINTEL-UX-286   | P3       | The add-on "Open …" link is underlined without a hover                                                             |
| LINTEL-UX-287   | P3       | An add-on with no code loads from package.json alone                                                               |
| LINTEL-UX-335   | P3       | Tables named only under `personalData` are labelled personal on the Add-ons screen                                 |
| LINTEL-UX-336   | P2       | Dust or contours used alone hid a section's own picture. Seen in a browser and fixed                               |
| LINTEL-UX-337   | P3       | Narrowing the window no longer closes the shader code box or loses its code                                        |
| LINTEL-UX-328   | P3       | A site with no home page keeps the automatic header and footer, with its own name                                  |
| LINTEL-UX-005   | P3       | An empty upload says it is empty; an SVG that can't be opened because of an outside link says so                   |
| LINTEL-SPEC-005 | P3       | `orders:*` is off the Admin role. The rest of the report no longer applies                                         |

Each has its own commit on the branch, with the item's words in its message.

## LINTEL-UX-332: one function for both servers

`website/website-routes.ts` holds `addWebsiteRoutes`, called by `site-server.ts` and `built-in-public-site.ts`. Only the production server's `/api` 404 hook stays outside it, as development has no `/api` prefix.

`website-routes.test.ts` starts both real servers and compares every route they register, and checks the website's route plugins are registered in that one file. To prove the first test, a route was added to the production file alone: it failed naming that route, and the change was taken out.

## LINTEL-UX-334: who an app's page is for

Daniel agreed to limit the page. The rule itself was chosen here, so it is set out for his review (`apps/app-page-audience.ts`):

- `admin.page.roles` in the manifest lists who it is for, from the six built-in roles. Owners always see it.
- With a list, nobody else sees it, custom roles included.
- With no list, as for every app installed today, everyone sees it except clients and Viewers.

The server leaves `page` out of `GET /apps/extensions`, so the sidebar item, the screen and the address go together: someone it isn't for gets Page not found. The install review says who it is for. The docs for building and using apps are updated.

Left as they were: dashboard widgets and editor panels still show for every role, and `POST /apps/:id/session-token` still gives any signed-in person a token, as it can't tell which part of the app is asking. That token carries only what the person may do anyway.

## LINTEL-UX-288: pasting several

With several selected, copies go after the last selected in page order. Tested with boxes, this was worse than the report said: they landed inside the first box. With one selected, pasting works as before, and a group pasted that way now stays selected. Undo takes it back in one step.

## LINTEL-UX-285: the consent box on the canvas

`builder-data.service.ts` now passes each form through `withRequiredConsent`, the function the website uses, so the two can't differ. The test needs a form with no box of its own: the first version used a template that has one, so it failed with and without the fix, and was corrected before it was kept.

The browser check used a small test add-on with `formConsent`, not the Newsletter add-on: that add-on only asks once connected to a real Mailchimp or Brevo account.

## LINTEL-UX-287: an add-on with no code

The code was changed, not the docs' promise. `dataOnly` in `addon-package.ts` is true when package.json names no `server`, nothing is built, there is no `src/server`, and it declares tables or personal data. Lintel then lists it from package.json alone, and `lintel addons build` says there's nothing to build. One that names a `server`, has `src/server` or declares nothing still gets the "server file is missing" message, so an unbuilt add-on isn't mistaken for one. The docs now say to leave out `server`.

## LINTEL-UX-335: tables named only under personalData

The details dialog now lists them with their personal columns. This is for the details only. A first version changed `findOwnTables`, which also feeds Export and Delete data, so Delete data would have emptied tables named this way. Two existing tests caught it, and the label was moved to the details alone. Whether those tables should be exported or emptied is a separate question for Daniel.

## LINTEL-UX-336: dust or contours alone

Reproduced in Chromium with the real effect module: `background-image` went to `none` once the drawing showed. It is the same fault as LINTEL-UX-253, on the older path for one look alone, and is P2 for the same reason. Dust and contours have no still version, so a picture on the section is the designer's. They now leave it in place, and it shows through. Mesh, light and the rest still step their still look aside, and a test holds that for mesh. `shader-backgrounds` grows by 11 bytes gzipped.

Existing sites that use dust or contours over a picture will now show that picture. That is the point of the fix, but it changes how those pages look.

## LINTEL-UX-337: narrowing the window

Reproduced in a browser: at 390px the code box closed, and after widening again the code and the selection were gone. `page-design/DesignerWhenWide.tsx` keeps a designer that has already opened mounted and hidden under the note, for pages and for blocks. So nothing is lost, not only shader code. A window that opens narrow still doesn't start the designer. The code box sits over the note while the window is narrow, and works at 390px.

## LINTEL-UX-328: the sample footer

The look goes live at once by design, and the template's navigation and footer with it. While the site has no home page, `renderWithHead` now leaves them out, so the "no home page yet" message has the automatic header and footer with the site's own name. Once a home page is published, they show.

## LINTEL-UX-005 and LINTEL-SPEC-005

- **UX-005:** a 0-byte file now gets 422 `EMPTY_FILE`. An SVG that can't be opened and has an outside link gets 422 `SVG_LINKS_OUTSIDE`, not "damaged". SVGs with outside links that do open still upload, as before.
- **SPEC-005:** the catalogue has "Design pages" now, `automations:*` comes from the Automations plugin's own permissions, and no document in the repository still makes the "manage updates" claim. `orders:*` was the one thing left: nothing checks it, so it's gone from Admin. `commerce:*` still covers orders.

## LINTEL-UX-326

Already fixed in `3936dee3`, with its test in `f9c2359f`. The "Open" row in the first table is older than the "Fixed" row below it. That test was run again here and passes.

## Still open, found here

- **LINTEL-UX-338 (P3):** the details of an add-on with no code still say it "runs inside your site with full access". It runs nothing.
- **LINTEL-UX-339 (P3):** on a site with no home page, a 404 at another address still shows the template's navigation and footer. Telling a site with no pages from a blog-led site with no home page needs more than this small fix.

## P3s left, and why

No earlier P3 is left open. The two above are new. None of the open P3s needed a real provider or a real host. Older "Open" rows were checked against the later rows and fix logs (UX-002, UX-003, UX-157, 158, 159, 318, 319, 324, 326, VIS-001, SEC-003), and all are fixed.

## Test runs

Targeted runs after the last code change, none failed:

- **Core:** 51 files, 426 tests: website, production, apps, add-ons, roles, media uploads, public forms, site sections, site effects, Visitors, A/B tests, test checkout, Liquid and `postgres-only-code`.
- **Admin:** 11 files, 73 tests: apps, add-ons, page design, blocks.
- **Builder:** 7 files, 81 tests: editor, PageBuilder, client editing, element stylesheet. In Chromium, 1 file, 6 tests: the placed grid.
- **Motion:** 6 files, 59 tests: effects catalogue. In Chromium, 2 files, 38 tests: creative effects, shader studio.
- **Motion editor:** 1 file, 17 tests: shaders.
- **Command line:** 1 file, 10 tests: add-ons.

Format check and ESLint on the changed files: clean. `pnpm typecheck`: 29 of 29 tasks. `pnpm build`: 18 of 18 tasks. The full suite wasn't run here: it runs at merge.

## Browser checks

Screenshots are in `docs/qa/screenshots/open-p3/`.

| Item           | Desktop                | 390px                             | Result                                                       |
| -------------- | ---------------------- | --------------------------------- | ------------------------------------------------------------ |
| UX-334         | Light and dark         | Light and dark                    | Owner: Stock and Help desk. Client: Help desk. Editor: Stock |
| UX-334 address | Light                  | Not checked                       | Client at `/apps/stock-sync`: Page not found                 |
| UX-333         | Light and dark         | The designer isn't shown at 390px | Client 0 guides, Owner 6                                     |
| UX-288         | Light and dark         | The designer isn't shown at 390px | One, Two, One, Two, Three, with the copies selected          |
| UX-285         | Light and dark         | The designer isn't shown at 390px | The box shows on the canvas                                  |
| UX-286         | Light and dark         | Light and dark                    | `text-decoration-line: underline`                            |
| UX-287, 335    | Light and dark         | Light and dark                    | The add-on is On, with `email` labelled Personal data        |
| UX-336         | Light and dark         | Light and dark                    | Picture and canvas both there on the website                 |
| UX-337         | Light, narrowed to 390 | Light; dark not checked           | Code and selection kept                                      |
| UX-328         | Light and dark         | Light and dark                    | No sample name; the site's own name shows                    |
| UX-332         | Production build       | Not checked                       | Site, admin, API 404, Visitors beacon on a published page    |

On the production build, Owner and client signed in through the real sign-in page, with the sidebar as above and no page errors.

Not checked in a browser:

- UX-005 and SPEC-005 after the fix: tests only. UX-005 was first reproduced through the running API.
- UX-336's "before" as a screenshot. The old module was rebuilt for one, but the page didn't load the effect, so those shots were deleted. The reproduction is the failing browser test.
- UX-333, UX-334, UX-285 and UX-328 before the fix in the running admin, apart from UX-328's sample name on the running website: reproduced by failing tests.
- The code box in dark mode.
- A real Newsletter connection, a real app server (the test apps framed the local website), Firefox and WebKit.

## Follow-up: UX-338, UX-339 and UX-335's Export and Delete data

Added after the above, which stays as it was. This section gives the newer state of "Still open, found here", and of the UX-335 note.

| ID            | Severity | Status  | Outcome                                                                                                  |
| ------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------- |
| LINTEL-UX-338 | P3       | Fixed   | The details of an add-on with no code say so, and no longer say it runs inside the site with full access |
| LINTEL-UX-339 | P3       | Fixed   | A 404 on a site with no home page uses the automatic header and footer                                   |
| LINTEL-UX-335 | P3       | Changed | Tables named only under `personalData` are now in Export and Delete data, wherever declared tables are   |

- **UX-338:** `GET /addons` gives `dataOnly`, and the dialog shows "It has no code of its own: it only says what data it keeps." An add-on with code keeps the warning.
- **UX-339:** `findHome` in `site-pages.service.ts` says whether the site has anything to show at "/", and both the home page and a 404 use it. A site led by a blog list has a home, so it keeps its own navigation and footer on a 404.
- **UX-335:** Daniel's decision through the coordinator: an owner would expect these tables to go with the others. `findOwnTables` now includes them, so the details, Export and Delete data share one list. Lintel's own tables are still left out, whichever way they are named.

Two existing tests had to change, as they listed exactly what is exported and emptied, and the add-on in them now has one more table. What they check still holds, so they were extended, not loosened: they now expect that table, with a row in it, and that it is emptied. The test that Lintel's own tables are never exported or emptied was kept, and its add-on now names `shop_customers` under `personalData` too.

**Left as it was:** backups go by `listAddonTableNames`, which reads `tables` and `database.tables`, so a table named only under `personalData` is exported and emptied but not backed up. As with a declared table, Delete data trusts what an add-on names, so it could name another add-on's table.

**Tests:** core `src/website`, `src/production`, `src/site-sections`, `src/addons` and `postgres-only-code`: 19 files, 140 passed. Admin `src/addons`: 3 files, 18 passed. ESLint and format clean on the changed files; `pnpm typecheck` 29 of 29. In the first of those runs, "are wired up in one place only" in `website-routes.test.ts` failed once (139 passed). The error wasn't captured, and it passed alone, in its folder twice, and in the same run again. The test reads every source file inside the default 5 seconds, and the machine was busy, so a timeout is likely but unproven. It now has 30 seconds. **Browser:** UX-338 and UX-339 at desktop and 390px, light and dark, on the dev servers. Screenshots are `ux338-*` and `ux339-*`. Export and Delete data of these tables: tests only.

## Backups for tables named under personalData

- **LINTEL-UX-340:** a table an add-on named only under `personalData` was exported and emptied but left out of backups. `listAddonTableNames` now includes it, and a test checks it.
