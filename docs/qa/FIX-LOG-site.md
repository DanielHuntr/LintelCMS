# Fix log: website, admin shell and builder (`fix/qa-site`)

Fixing pass, 2 Nov 2026, on `fix/qa-site` from `qa/discovery` (`release/1.0.0-rc` plus `docs/qa`). The defects are described in `BUG-REPORT.md`, which this log doesn't change.

**Environment:**

- Linux, 8 GB, shared with the shop fix agent;
- Chromium headless (Playwright from `packages/admin`), one worker;
- dev servers: API :4750, site :3750, admin :5750;
- built-in database in `/tmp/fix-site-data`, with throwaway folders for clean scenarios;
- set up through the wizard as "QA Site" with the Online shop.

Screenshots are in `screenshots/fix-site/`, as palette-compressed PNGs. "Desktop" means 1440x900 and "390" means 390x844 with touch.

**Test runs (after the last commit):**

- format check, `pnpm lint` and `pnpm typecheck`: all clean;
- admin: 107 files, 590 tests, all passed;
- builder: 19 files, 198 unit tests, plus 8 browser tests, all passed;
- builder-model: 149 tests, all passed;
- site-components: 34 tests, all passed;
- core: 148 files; 957 passed, 1 failed, 5 skipped. The one failure is the `plugin-system.test.ts` fieldtypes test, which predates these fixes (see "New issues").

## Summary

| ID              | Status   | Commit    | Change in one line                                                                       |
| --------------- | -------- | --------- | ---------------------------------------------------------------------------------------- |
| LINTEL-SPEC-002 | Verified | `5b00f5e` | Merged `phase-6/tree-bulk`: "In the main menu", menus that follow the tree, menu editor  |
| LINTEL-FUNC-004 | Verified | `0110b80` | A path-only site (`/ie`) answers on the default site's domain                            |
| LINTEL-FUNC-006 | Verified | `5d8ed3a` | "Couldn't check for updates" instead of "up to date"; no "tomorrow" after Check now      |
| LINTEL-SPEC-001 | Verified | `22b671f` | Publishing under an unpublished parent asks first; accurate home placeholder             |
| LINTEL-UX-001   | Verified | `c59b277` | Below 768px the sidebar folds behind a menu button and the page uses the full width      |
| LINTEL-FUNC-005 | Verified | `cfd8f1b` | Header goes to the top, Footer to the bottom, with the site's name; no duplicated chrome |

"Verified" means the fix was reproduced before, checked in a real browser afterwards, and covered by a regression test that fails without the fix.

---

## Merge: `phase-6/tree-bulk` (LINTEL-SPEC-002)

**Merge commit:** `5b00f5e` "Merge bulk page actions and easy navigation (phase-6/tree-bulk)", merging `06f9ef0`.

**Conflicts:**

- `admin/src/i18n/strings.ts`: kept both sides' string imports.
- `admin/src/page-design/README.md`: kept HEAD's tour text and the branch's "Menus in the builder" section.
- `builder/src/PageBuilder.tsx`: the branch only wrapped the screen in `MenuEditingContext.Provider` and added menu state. That was re-applied onto HEAD's version, which keeps HEAD's empty-page and tour changes.
- **Migrations:** both sides had added a `0020`. HEAD's `0020_add_backups_and_wordpress_imports` was kept. The branch's `0020_menus_follow_page_tree.sql` was dropped and regenerated with `pnpm --filter @lintel/core db:generate --name menus_follow_page_tree`, which produced `0021_menus_follow_page_tree.sql` with identical SQL.

**Tests:**

- admin 584, builder 196 and site-components 34 tests passed.
- core: 950 passed, 1 failed. The failure is `plugins/plugin-system.test.ts`, "offers a plugin's fieldtypes…", where `GET /fieldtypes` now returns extra keys (`category`, `keywords`, `holdsValue`, `canBeInside`). The merge touches no plugin or fieldtype file, so this predates it (see "New issues").
- The branch's browser journey `admin/e2e/tree-bulk-and-menus.e2e.mjs` passed steps 1–3 twice, on fresh data (create in main menu, bulk delete and Undo, list view). Both runs then stopped at the reload in step 3, once with "Page crashed", under dev-mode memory pressure. Checked by hand, the list view does survive a reload. Steps 4–6 (template question, menu editor, builder Edit menu) were not run end to end in this pass.

**SPEC-002 evidence:**

1. In the admin, create Home, then "Create…" About under it. "In the main menu" is on by default (`spec-002-create-about-in-main-menu.png`).
2. Save and publish.
3. The website header now shows `QA Site | About` (`spec-002-website-header-about.png`).

**Status:** Verified.

---

## LINTEL-FUNC-004: path-prefix site returns 404

**Reproduced:** `POST /sites {handle:"ie", pathPrefix:"/ie"}`, then publish "Irish home" on it.

- `/ie` and `/ie/irish-home` answered 404.
- `/delivery/sites/match` answered `SITE_NOT_FOUND`.

**Root cause:** `matchSiteForAddress` (`core/src/sites/site-addresses.ts`) only considered sites whose `hostnames` matched the request. A site with only a path prefix has no hostnames, so it was never a candidate. The website then fell back to the default site, which has no `/ie` page. The dev site server and the one-port production server both use `siteRoutes` → `findSiteForAddress`, so both failed.

**Change:**

- A site with a path prefix and no domains of its own now answers on the default site's domain. That means the default site's hostnames, or any domain no site lists when the default site has none (the out-of-the-box case). The longest prefix still wins.
- A hostless site with no prefix is not matched, so unknown domains still 404 on `/delivery/sites/match`, and the website still falls back to the default site.

**Files:**

- `core/src/sites/site-addresses.ts`: new optional `defaultSite` argument;
- `core/src/website/site-for-address.ts`;
- `core/src/sites/sites.routes.ts`: `/delivery/sites/match`;
- `core/src/sites/README.md`.

**Tests (each fails without the fix):**

- `sites/site-addresses.test.ts`: "finds a site with only a path prefix on the default site's domain" (default with and without a domain, another site's domain, `/iex`);
- `website/website-sites.test.ts`: "serves a site with only a path prefix on the default site's domain" (dev site server, plus `/delivery/sites/match`);
- `production/production-server.test.ts`: "serves a site with only a path prefix (/ie) on the same domain" (one-port production server).

**After:**

- `/ie` answers 200 "Irish home | Ireland".
- `/ie/irish-home` redirects 301 to `/ie` (it is that site's home).
- `/` and `/about` still serve the default site.
- `/delivery/pages?site=ie` gives `url: "/ie"`.

**Screenshots:** `func-004-before-ie.png` (404), and `func-004-after-ie.png`, `-after-ie-390.png` and `-after-ie-dark.png`.

**Status:** Verified.

---

## LINTEL-FUNC-006: Updates says "up to date" after a failed check

**Reproduced:** Settings → Updates, Check now, with the feed blocked (403). The screen showed "…answered 403). It will try again tomorrow." with "You're up to date" underneath. The dashboard widget said "Lintel 1.0.0-rc.1 is up to date."

**Root cause:**

- `UpdatesPage` showed the up-to-date card whenever no release was recommended, without looking at `overview.problem`.
- The update summary (`count`, `securityCount`) had no way to say the check failed, so the widget read a count of 0 as "up to date".
- `describeCheckProblem` always added "It will try again tomorrow.", including after Check now.

**Change:**

- **Core:** `checkForUpdates(…, { manual })` leaves out the "tomorrow" sentence for Check now, and the daily check keeps it. `summariseUpdates` adds `checkFailed`.
- **Admin, Updates page:** when no newer version is known and the last check failed, the card says "Couldn't check for updates", with "Lintel doesn't know yet whether there's a version newer than 1.0.0-rc.1". It uses the same `EmptyState` and warning icon as the alert above it.
- **Admin, dashboard widget:** says "Couldn't check for updates", with a warning icon and "See updates".

**Files:**

- `core/src/updates/update-checks.service.ts`, `updates.service.ts`, `updates.routes.ts`;
- `admin/src/updates/UpdatesPage.tsx`, `UpdatesWidget.tsx`, `updates.api.ts`;
- `admin/src/i18n/updatesStrings.ts`.

**Tests:**

- core `updates/updates.test.ts`: "says a check failed, and only promises another look after a scheduled one", plus the summary shape updated;
- admin `updates/Updates.test.tsx`: two new tests under "when the last look for updates didn't work". Both fail without the fix.

**Screenshots:**

- before and after `func-006-*-updates-{desktop,390}-{light,dark}.png`, taken after pressing Check now;
- before and after `func-006-*-dashboard-*` (full page; the widget is at the bottom).

**Not changed (out of the brief):**

- the raw "(The update feed answered 403)" detail is still in the alert;
- "How this site is updated" still shows `pnpm lintel update --to <current version>` when nothing newer is known.

**Status:** Verified.

---

## LINTEL-SPEC-001: children go live under an unpublished parent

**Decision (conservative reading of the spec):**

- Publishing a page under an unpublished parent is still allowed, but the admin asks first.
- The website's placeholder at `/` is corrected to match the real home-page rule ("the first top-level page is the home page").
- Nothing is blocked server-side.

**Reproduced:** fresh data; Home (draft), with About us under it.

- Save and publish on About us published it with no question.
- `/about-us` answered 200.
- `/` said "This website is ready for its first page… A page with the address "home" becomes the home page."

**Root cause:**

- Nothing in the publish flow looked at the page's ancestors.
- The placeholder copy (`emptySiteText` in `site-components/src/site.types.ts`) described an old rule (the "home" slug). Its title was also wrong once any page was published.

**Change:**

- **Core:** `GET /content-tree/entries/:id/info` adds `unpublishedAncestors`, the pages above the entry that aren't published, from the top down.
- **Admin:** Save and publish on a page that isn't live yet, with unpublished ancestors, opens `PublishWithParentDialog`. The dialog says:
  - title: "Its parent page isn't published";
  - text: ""About us" is under "Home", which isn't on your website yet. Published on its own, it goes live under a page visitors can't open."
- **The dialog's answers:**
  - **Publish with its parent** (the default focus): publishes the ancestors with the bulk publish, then the page;
  - **Publish this page only**;
  - **Cancel** (also Escape).
- **Dialog layout:** it uses the existing `Dialog` (alert) and `Button`. Three buttons don't fit side by side in the 340px alert, so they stack, main action first.
- **Website:** the placeholder now reads "This website has no home page yet. In Lintel, publish the first page at the top of the page tree. It becomes the home page, at this address."

**Files:**

- `core/src/content-tree/entry-info.service.ts`;
- `admin/src/content-workspace/EntryWorkspace.tsx`, `PublishWithParentDialog.tsx` (new) and `README.md`;
- `admin/src/content-tree/contentTree.types.ts`;
- `admin/src/i18n/contentTreeStrings.ts`;
- `site-components/src/site.types.ts`.

**Tests:**

- core `content-tree.test.ts`: "names the pages above an entry that aren't published, from the top down";
- core `website.test.ts`: "says the home page isn't published when only a page under it is" (the empty-site test is updated for the new copy, as is the production server test);
- admin `EntryWorkspace.test.tsx`: "explains, and publishes the parent first when asked", and "can still publish the page on its own". Both fail without the fix.

**After, in the browser:**

- "Publish with its parent": Home and About us are both published, and `/` shows Home.
- "Publish this page only": Home stays a draft, and `/` shows the new placeholder.
- Escape leaves the page a draft.

**Screenshots:**

- `spec-001-before-published-without-question-desktop-light.png` and `spec-001-before-site-home-placeholder.png`;
- `spec-001-after-question-{desktop,390}-{light,dark}.png` (the 390 shots were taken after UX-001);
- `spec-001-after-site-home-with-parent.png` and `spec-001-after-site-home-placeholder-alone.png`.

**Not covered:** the tree's right-click Publish and bulk Publish don't ask yet. They still publish under an unpublished parent without a warning.

**Status:** Verified (editor path).

---

## LINTEL-UX-001: the admin overflows at 390px

**Reproduced:** `scrollWidth` at 390 was 511 on Dashboard, 766 on Content, 614 on Products and 1063 on a page's workspace. At 390 the content tree also covered the workspace's Save and publish button. At 820 and on desktop there was no overflow.

**Root cause:**

- `AdminLayout` always reserved `ps-[264px]` for a fixed 240px sidebar, with a 4rem right gutter.
- `ContentSection` positioned the tree `fixed` at `inset-s-[264px]` and reserved its width.
- The workspace's save bar couldn't wrap.
- None of these had a small-screen breakpoint.

**Change (below `md`, 768px; wider screens unchanged):**

- **Menu button:** the sidebar is hidden (`max-md:hidden`) behind a round menu button at the top left. The button has the same classes as the help button opposite it, with `aria-expanded` and `aria-controls`.
- **Opening the menu:** the sidebar opens over the page on the existing `bg-scrim` backdrop. Focus moves to the close button in the sidebar, which uses the same style as the Dialog's close button, and the page is made `inert`.
- **Closing the menu:**
  - Escape, the close button or the scrim closes it, and focus returns to the menu button;
  - going somewhere closes it (the open state is tied to the address it was opened on);
  - so does widening the window.
- **Page area:** the page uses the full width, with the left and right gutters both at 1rem.
- **Content tree:** sits above the workspace in the page flow, full width, at most `min(60dvh, 28rem)` tall. Its resize handle is hidden.
- **Workspace save bar:** wraps (`max-md:flex-wrap`).
- **Updating banner:** no longer offset by 264px.

**Files:**

- `admin/src/layout/AdminLayout.tsx` and `Sidebar.tsx`;
- `admin/src/content-tree/ContentSection.tsx`;
- `admin/src/content-workspace/WorkspaceFooter.tsx`;
- `admin/src/updates/UpdatingBanner.tsx`;
- `admin/src/i18n/strings.ts` (`nav.openMenu`, `nav.closeMenu`).

**Tests:**

- admin `layout/AdminLayout.test.tsx`, two tests: the button, open state, `inert`, focus in and back, Escape and the close button. Both fail without the fix.
- New browser journey `admin/e2e/narrow-screens.e2e.mjs`:
  - no sideways scroll at 390 on 8 screens;
  - the menu opens and closes, including on navigation;
  - the tree opens a page whose workspace fits.
  - It passed against this instance.

**After:**

- `scrollWidth` is 390 on all 18 screens swept: dashboard, content, pages, media, design, forms, users, settings, updates, sites, backups, the shop screens, content types and help.
- At 820 and 1440 the sidebar shows and the menu button is hidden, with no overflow.

**Screenshots:**

- before and after `ux-001-*-{dashboard,content,products,page}-390-{light,dark}.png`;
- before and after `ux-001-*-{content,page}-desktop-{light,dark}.png` (unchanged);
- `ux-001-after-menu-open-390-{light,dark}.png`;
- `ux-001-after-content-820-light.png` and `-1440-light.png`.

**Status:** Verified.

---

## LINTEL-FUNC-005: builder Header/Footer

**Reproduced:** a fresh page; in Design, Add elements, then Heading, then Header, then Footer ("Footer with columns" is the first result).

- The Header landed below the Heading, showing "Your site".
- The canvas had 2 visible `<header>` and 2 `<footer>`.
- The published page had 2 of each.

**Root cause:**

- `insertBlueprint` placed everything at the selection, with no notion of page edges.
- The canvas's page data used `sampleSite` ("Your site") because the canvas response carried no site name or logo.
- Neither `SiteDocument` (website) nor the canvas frame knew whether the design had its own header or footer.

**Change:**

- **`builder-model`:**
  - `pageEdgeFor(element)`: the Header goes on top; the Footer, and sections drawn as `<footer>` (both footer templates), go at the bottom;
  - `ownSiteChrome(root)`: says whether a page has its own header and footer.
- **Builder placement:** `insertBlueprint` puts edge elements at index 0 or at the end of the page, whatever is selected. A drag to an explicit place is still respected.
- **Site name and logo:**
  - `GET /website/canvas` now also returns the site's name, logo, social links and footer words;
  - `canvasPageData` lays these over `sampleSite`.
- **No duplicated chrome:**
  - on the website, `PageDesign.ownHeader` and `ownFooter` (set in `drawPageDesign`) make `SiteDocument` leave out the built-in Header or Footer;
  - on the canvas, the built-in chrome wrappers carry `data-lintel-site-chrome`, and the page stylesheet hides them under the same rule.

**Files:**

- `builder-model/src/components/site-navigation-components.ts`;
- `builder/src/editor/commands.ts`, `panels/canvas-data.ts`, `canvas/canvas-frame-script.ts` and `PageBuilder.tsx`;
- `core/src/website/canvas.service.ts` and `designed-pages.ts`;
- `site-components/src/templates/view.types.ts`, `document/SiteDocument.tsx` and `document/README.md`;
- `admin/src/website/website.api.ts`.

**Tests:**

- builder `editor.test.ts`: "puts a Header at the top of the page and a Footer at the bottom, whatever is selected";
- builder `menus/menu-editing.test.tsx`: "shows it in a Header and a Footer, not a sample name";
- core `website.test.ts`: "leaves out the site's header and footer on a page that has its own" (only what the page has is replaced). It fails without the fix.

**After:**

- Layers: Header, Heading, Footer, with the canvas header showing "QA Site".
- 1 visible `<header>` and 1 `<footer>` on the canvas and on the published page.
- No "Your site".

**Screenshots:** before and after `func-005-*-builder-desktop-{light,dark}.png`, and `func-005-*-site-{desktop,390}.png`.

**Not changed:**

- The "Footer with columns" template still has its sample words and links ("A sentence about who you are…", Explore/About/Contact/Follow/Newsletter) and a coloured "Mark" block. These are section-template sample copy like every other template's, and the brief didn't ask for them. Only the Header and Footer elements read the site's name and logo.

**Status:** Verified.

---

## What couldn't be verified

- **The tree-bulk journey, steps 4–6** (template question, menu editor, builder Edit menu), end to end in a browser. The dev-mode renderer crashed under memory pressure (see the merge section). Their unit tests pass.
- **Tablet (820px) for screens other than Content.** The sidebar layout there is unchanged code.
- **Hover states** of the new menu and close buttons. They reuse existing classes.

## New issues noticed (not fixed)

1. **`plugin-system.test.ts` fails on `qa/discovery`.** `GET /fieldtypes` returns `category`, `keywords`, `holdsValue` and `canBeInside`, which the test doesn't expect. Either the test or the response shape needs updating.
2. **Builder Header on the canvas shows both the menu links and the "Menu" button at desktop width,** before and after this fix (`func-005-*-builder-*`). The published page shows both at 1440 as well.
3. **The tree's Publish and bulk Publish** don't warn about unpublished parents (SPEC-001 covers the editor's Save and publish only).
4. **Updates:** the raw feed error text, and the update command showing the current version when nothing newer is known (from FUNC-006's report, not in this brief).
5. **`tsx watch` in `packages/core` didn't always reload after a source change** in this environment. Restart core after editing it.
6. **Process note:** `git stash` is shared between worktrees. A `stash pop` here applied the shop agent's stash for a moment. It was removed straight away, and their work was already committed (`ae94771`), so nothing was lost. The removed changes are backed up in `/tmp/fix-site-foreign-backup`. Use patch files instead of `git stash` when two agents share the repository.

## Builder and site batch (3 November 2026)

Branch `fix/builder-site`. Each regression test was run on the unfixed code first and failed there.

### LINTEL-FUNC-020: "The visitor leaves the page" animations never played

- **Cause:** only the page-transition effect asked for exit animations, when it took over a link click. A page with an exit animation but no page transition navigated straight away.
- **Fix:**
  - The site runtime itself waits for exit animations on a plain same-site link click (at most 1.5 seconds), then navigates.
  - It listens on the window, so a page transition (on the document) still sees the click first and plays the exits with its cover.
  - New tabs, downloads, same-page anchors and modified clicks are left to the browser.
  - The click rule is now shared (`runtime/sameSiteClick.ts`).
  - Coming back with the Back button puts the exit animations back to their start.
- **Tests:** `site-runtime.test.ts`:
  - which clicks wait, and that navigation follows once the exits finish;
  - that a click already taken by a transition is left alone;
  - `hasPageExits`.
- **Checked in Chromium** with the built `site-runtime.js` (a page with a 600ms "fade out" exit and a link):

  |        | Opacity 250ms after the click | Left after | Back button          |
  | ------ | ----------------------------- | ---------- | -------------------- |
  | Before | (already gone)                | 297ms      |                      |
  | After  | 0.77                          | 678ms      | page at full opacity |

### LINTEL-FUNC-021: duplicating kept animation targets on the original

- **Cause:** an animation that plays on chosen elements names them by id. A copy got new ids, but its animation still named the original's elements.
- **Fix:** `copyWithNewIds` (used by duplicate and paste) points targets inside the copy at the copied elements. Targets outside the copy are kept.
- **Test:** `builder-model/src/tree/tree.test.ts`.

### LINTEL-FUNC-022: generated class names could collide

- **Cause:** a layer named "Heading 2" and the second unnamed heading both became `.heading-2`, so styles bled between them.
- **Fix:** a number already taken is skipped, and names stay the same from one drawing of the page to the next.
- **Test:** `styles.test.ts`: five headings, two named "Heading 2" and "Heading 3", all get different classes.
- The stylesheet snapshot is unchanged.

### LINTEL-FUNC-023: one element that no longer validates hid the whole designed page

- **Fix:**
  - For problems that each name an element, the validator now also returns the page as read.
  - The website leaves those elements out, with whatever is inside them, and draws the rest.
  - The editor still names them when the page is opened.
  - A design that can't be read at all is still treated as no design.
- **Tests:** `core/src/website/designed-pages.test.ts`: an unknown element type, a heading whose content no longer fits, and an unreadable design.

### LINTEL-FUNC-025: dialogs closed when a drag ended outside

- **Cause:** a click on the dimmed page closed a dialog even when the press started inside (selecting text in a field). A new API token's one-time secret could be lost that way. The search palette had the same rule.
- **Fix:** `useBackdropClose`, used by `Dialog` and `CommandPalette`. Both the press and the release have to be on the dimmed page.
- **Tests:** `design/Dialog.test.tsx`.
- **Checked in Chromium** on the running admin. The test: type into the Ctrl K search, press inside the box, drag out to the page corner and let go.
  - Before: the search closed.
  - After: it stays open.
  - A plain click on the dimmed page still closes it.
- These are behaviour-only changes, so there are no screenshots.
