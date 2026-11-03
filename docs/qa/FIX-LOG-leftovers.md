# Fix log: QA leftovers (`fix/qa-leftovers`)

The leftovers seen during the QA passes and not filed with an ID (see `TEST-RESULTS.md`, "Leftovers"), fixed on `fix/qa-leftovers` from `release/1.0.0-rc` at `73e47a2`. IDs `LINTEL-LEFT-001` to `-008` were given to the first eight in their commits; the rest are named here. `BUG-REPORT.md` isn't changed.

Each fix was reproduced first and has a regression test that fails without it.

## Summary

| Leftover                                                                | Commit                               | Change in one line                                                                                                    |
| ----------------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| LEFT-001 Purple-on-purple "Check out" button                            | `760c26b`                            | A link styled as a button stays readable on the website                                                               |
| LEFT-002 Shoppers told to "Connect Stripe"                              | `3f5c453`, `dae1f57`                 | Shoppers see "This shop isn't taking orders yet"; the owner gets a warning on the Shop home                           |
| LEFT-003 "No orders yet" with only imported orders                      | `0ef10fd`                            | Points to Imported                                                                                                    |
| LEFT-004 Header shows links and Menu together                           | `7284b83`                            | The Menu button only at small widths                                                                                  |
| LEFT-005 Publishing from the tree skips the unpublished-parent question | `4dd1f4a`                            | Right-click and bulk Publish ask about an unpublished parent                                                          |
| LEFT-006 "Footer with columns" sample copy                              | `0182552`                            | Follows the site's menu, with no sample copy                                                                          |
| LEFT-007 Updates: raw "403", needless command                           | `575a399`                            | Plain words; no update command for the version already running                                                        |
| LEFT-008 `plugin-system.test.ts` failing                                | `2330813`                            | Expects the current `GET /fieldtypes` shape                                                                           |
| Builder: no Link in the text bar, no Mod+B / Mod+I / Mod+K              | `f273bde`, `2dabaaa`                 | Link button with an address box; the shortcuts style the selected words, also while typing in a text                  |
| Builder: Ctrl+Z / Ctrl+Shift+Z only work from some places               | `52dc005`                            | Undo and redo from anywhere in the builder, except while typing in a box                                              |
| "Couldn't save · Try again" for a refused save                          | `e7184d4`                            | "Fix N fields to save", which goes to the first field                                                                 |
| Recycle bin banner doesn't clear on Restore                             | `326c560`                            | "Restored “…” as a draft." at the foot of the tree, replacing the deleted note                                        |
| Duplicate countries (UK, FX, DD, CS, YU…)                               | `b953972`                            | Country pickers and checks use the ISO 3166 codes (plus XK), each once                                                |
| Copy                                                                    | `dd2fc1e`                            | Plurals in the import summary, "Import an export from {product}", Search engines, Form element, unfinished conditions |
| Sidebar contrast (4.45:1 and 2.86:1)                                    | `ba89060`                            | Lighter tint and the secondary label colour: both 4.70:1                                                              |
| Roadmap placeholder in Settings                                         | on `fix/security-review` (`f4cb490`) | Removed there, with Settings reordered                                                                                |

---

## Builder: Link, and Mod+B / Mod+I / Mod+K

**Before:** the text style bar had Bold and Italic but no Link, and no shortcut styled selected words. While typing in a text on the canvas, the browser's own Ctrl+B made bold that was never saved.

**After:**

- The text-marks model takes an `href` per styled part (finished from the work-in-progress commit); the website draws it as `<a>`, the canvas without a followable address.
- The bar has a Link toggle: pressed when the selected words are one link, which it then removes; otherwise it opens a "Link to" box that accepts page addresses, `https://`, `mailto:` and `tel:`, and refuses anything else with a plain message.
- Mod+B and Mod+I toggle bold and italic on the selected words (the rule is shared with the bar's buttons, `inline-text/markToggles.ts`); Mod+K opens the Link box. While typing in a text on the canvas, the three end editing (keeping the words) and then act.

**Tests:** `TextStyleBar.test.tsx`, `editor.test.ts` (the keys), `advanced-rendering.test.tsx` (links on the website and canvas).

## Undo and redo everywhere

**Before:** the builder's keys were heard on its own element only. With focus on the page (after clicking empty space) Ctrl+Z went nowhere, and tabs and other controls that keep their arrow keys swallowed it.

**After:** text boxes keep their own undo; other controls pass Undo, Redo and Save on; a listener on the page catches them when nothing in the builder has focus.

**Test:** `studio.test.tsx`, "undoes and redoes with the keyboard wherever focus is, except in a text box".

## "Fix N fields to save"

**Before:** a save refused for its fields said "Couldn't save · Try again", and trying again failed the same way.

**After:** the save indicator says "Fix 2 fields to save" (counting a field's inner parts as the field), and pressing it goes to the first field with a problem, opening its tab or block.

**Test:** `EntryEditor.test.tsx`, "says how many fields to fix, and goes to the first".

## Recycle bin "Restored"

**Before:** Restore opened the restored page, so the bin's own "Restored" message was never seen, and the "moved to the recycle bin" note stayed at the foot of the tree.

**After:** Restore puts "Restored “About” as a draft." at the foot of the tree, replacing the old note, then opens the page.

**Test:** `RecycleBinPage.test.tsx`.

## Countries

**Before:** pickers listed every two-letter code Intl has a name for, so retired codes showed as duplicates ("United Kingdom" as GB and UK) and could be saved.

**After:** `builder-model/src/countries/country-codes.ts` holds the 249 ISO 3166-1 codes plus XK (Kosovo), each with a name. The admin's picker and the API's country check both use it.

**Tests:** `country-codes.test.ts` (each code once, each name once, retired codes refused), `CountryPicker.test.tsx`.

## Copy

- "1 posts" in the WordPress import summary: each count is plural-aware.
- "Import a Acme Studio export" when white-labelled: "Import an export from Acme Studio".
- Redirect tips pointed to "Settings → SEO tools → Redirects": now "Search engines", as the screen is called.
- "add a Form section": "add a Form element".
- "Shown when Title is ." for a rule without its value: "Choose what Title should be to finish this rule."

**Tests:** `i18n/copyFixes.test.ts`, `conditionTargets.test.ts`.

## Sidebar contrast

**Before:** the Search button's words were 4.45:1 and its shortcut hint 2.86:1 against the sidebar (axe).

**After:** the button's tint drops from 70% to 40% fill, and the hint uses the secondary label colour: both 4.70:1 in light mode, above 5:1 in dark. Only existing tokens are used.

**Test:** `AdminLayout.test.tsx`, which keeps the classes.

## Also fixed on the way

`payment-providers.test.ts` still expected the owner's "Mollie isn't connected yet…" at checkout after LEFT-002 changed shoppers' wording (`dae1f57`).

## Content tree batch (3 November 2026)

Branch `fix/content-tree`. Each regression test was run on the unfixed code first and failed there. These are server fixes with no screen changes, so there are no screenshots.

### LINTEL-FUNC-017: a page could be moved under a page on another site

- **Reproduced:** `POST /content-tree/move` putting a page under another site's home → 200.
- **Fix:** the move passes the page's site to the parent check, as creating and saving already did. The answer is now 400, "The parent has to be on the same site."
- **Test:** `content-tree.test.ts`.

### LINTEL-FUNC-018: which page is "/" depended on content type names (part fixed)

- **Reproduced:** add a second page-tree content type called "Archive" with a page at the top. Its page took "/" from Home, because sections went in alphabetical order.
- **Fix:** page trees go in the order their content types were made, both in the tree and when choosing "/". The first page at the top of the tree is still "/", and renaming a content type changes nothing. Other sections stay alphabetical.
- **Test:** `content-roots.test.ts`. "Archive" doesn't take "/", and renaming Pages to "Website" keeps Home at "/" and first in the tree.
- **Left for Daniel: drafts still count.** Skipping drafts was tried and taken back out:
  - Publishing pages in a different order would then move live addresses around. For example, Shop would be "/" until Home was published.
  - An existing test (`content-roots.test.ts`, "builds addresses from the site starts") expects the draft Home to keep "/".
  - With drafts counting, an unpublished home page shows "Page not found" at "/" until it is published, which is easy to understand and fix.
  - Marked "Part" in the bug report until Daniel decides.

### LINTEL-DATA-012: binning an entry unlinked its translations for good

- **Cause:** binning clears the link on every translation of the entries that go. Nothing noted which translations they were.
- **Fix:**
  - The bin item now records those links (`translations`).
  - Restoring links each translation back, unless it has been linked to something else meanwhile.
  - Items binned before this have no record, so they restore as before.
- **Test:** `recycle-bin.test.ts`: the French translation's `originId` is empty while the English page is binned and back after restoring, and the page lists it again.

### LINTEL-FUNC-026: webhooks used one time for a whole run

- **Cause:** a run of up to 25 deliveries took the time once, at the start. With slow receivers (up to 10 seconds each), later deliveries were claimed with a lease that had already run out, so another server could send them as well. They were also signed with a time minutes old, which receivers checking freshness reject.
- **Fix:** each delivery is claimed, signed and given its retry time at the moment it is sent. `deliverDue(now)` still sets where the run starts.
- **Tests:** `webhooks.test.ts`:
  - New: three deliveries to a receiver that takes 300ms each are attempted at least 500ms apart. Before, all three had the same time.
  - The retry test now measures each gap from that attempt (1, 5, 30, 120 and 720 minutes) rather than from the run's start time.

## Custom blocks merge (4 November 2026)

`phase-6/custom-blocks` is merged into the release line on `merge/custom-blocks`.

- **Migration:** became `0023_add_custom_blocks.sql`, regenerated with `db:generate`. Its SQL is the same as the branch's: the `blocks` table with `tenantId()`, and a unique (tenant, handle) index.
  - Checked on a fresh database (the suite) and on a copy of a database made on the release before it.
- **Decision record:** became `0027-custom-blocks.md`, with its links updated.
- **Conflicts:** release's behaviour was kept where both sides changed the same thing:
  - field renames and conversions in blueprints;
  - the content routes;
  - the page designer's data sources;
  - Insert's plugin filter;
  - the builder's layout.

  The blocks parts were added on top.

- **Fixes the merge needed:**
  - Insert items need keywords.
  - Tests started an empty page with a button that no longer exists.
  - The block designer now previews effects, and says on a phone that it needs a bigger screen (as the page designer does, LINTEL-UX-013). There's a regression test.
- **Checked:** the blocks journey (`custom-blocks.e2e.mjs`) passes in a real browser, and the block screens were checked at desktop and 390px, light and dark.
- **Left as it is:**
  - The block screens stay at `/design/blocks`. They'll move when Design moves into the content tree (the designer push).
  - The block designer doesn't yet pass data sources or the menu editor, so lists and menus inside a block's design show no real data.
