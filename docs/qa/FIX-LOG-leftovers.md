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
