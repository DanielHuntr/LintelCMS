# Fix log: the admin's everyday screens (`ux/ten-out-of-ten`)

A pass to make each everyday screen do one obvious thing, from the review of the batch 3 screenshots and `UX-PASS-batch-3.md`, on `ux/ten-out-of-ten` from `release/1.0.0-rc` at `f130ee9`. Daniel asked for it ("can we fix it to be 10/10") and approved the layout changes.

Each change has a test that fails without it, and was checked in Chromium at 1440px and 390px, light and dark, against the UX pass's data. Screenshots are in `screenshots/ux-ten/`, prefixed `ten-`.

## Summary

| Screen             | Commit               | Change in one line                                                                              |
| ------------------ | -------------------- | ----------------------------------------------------------------------------------------------- |
| Page editor's bar  | `988eff4`, `8040942` | The page's state in words; Save only when there's something to save; no greyed-out "Published"  |
| Page with a design | `16f51ff`            | "Body isn't shown on your website, because this page has a design", tinted, with an icon        |
| Settings           | `fc9b28f`            | A search box; one-row groups ("Search engines") folded into the website's own group             |
| Products           | `67a087e`            | A wide list: photo, name and variants, status, price, stock; folds on a phone                   |
| Content            | `f7b597c`            | The page tree folds away ("Hide pages" / "Show pages"), remembered, folded by default on phones |
| Builder: Form      | `2ac44f8`            | The chosen form is drawn on the canvas, as the website shows it                                 |
| Builder: phone     | `a8ffe95`            | "The designer needs a bigger screen", with View page and Back (LINTEL-UX-013)                   |
| Builder: Insert    | `32de990`            | Sections are cards with a bigger sketch and what each is for, shown in the list                 |

## Page editor's bar

**Before:** a live page with nothing new showed a pale "Published" button that looked disabled, and Save showed with nothing to save, so people couldn't tell where the page stood or what to press. The header repeated the state as badges (LINTEL-VIS-002).

**After:**

- The bar says, with a coloured dot: "Live on your site", "Live, with changes not published", "Draft, not on your site yet" or "Scheduled for {date}".
- Save shows only while there's something unsaved, after a failed save, or for people who can't publish.
- The main button is "Save and publish" or "Save and publish changes"; a live page with nothing new has just "Publishing options" (Schedule…, Unpublish).
- The header no longer repeats the state; on a phone the status has its own line.

**Tests:** `EntryWorkspace.test.tsx`, "says where the page stands in words…" and the updated "saves and publishes from the bar along the bottom".

## Settings

**After:** "Search settings" filters rows by their name, description and group, with "No settings match" when nothing does. Content types joins the Site group, and a plugin's lone row joins it too; a plugin bringing two or more rows keeps its own group.

**Tests:** `settingsGroups.test.ts`, `SettingsPage.test.tsx`.

## Products

**After:** a table across the page: a square photo (or a neutral tile), the name with its variant count, the status badge, the price range and the stock. The name links to the product and covers the whole row. On a phone, price and stock fold under the name and the column headers are for screen readers only.

**Test:** `ShopScreens.test.tsx`.

## Content tree

**After:** a "Hide pages" button beside the tree's search folds it away and the page takes the width; "Show pages" brings it back. The choice is kept in this browser; on a phone it starts folded, so the page comes first.

**Test:** `ContentTree.test.tsx`, "folds away to give the page room, and remembers it".

## Also checked in the browser

The QA leftovers merged into release: the builder's Link box (refuses `javascript:` with a plain message, `ten-builder-link-box-dl.png`), and the sidebar's Search contrast.

## Builder: the chosen form on the canvas

**Before:** a Form element with a form chosen still said "Choose a form in the Content panel." on the canvas: the builder only knew forms' names.

**After:** `/website/builder-data` gives `sampleForms`, each form read the way the website reads it (`readForm`, without step dividers), and the canvas draws the chosen one (`ten-builder-form-dl.png`).

**Tests:** `public-forms.test.ts` ("gives the page builder every form…"), `element-panels.test.tsx`.

## Builder on a phone

**Before:** at 390px the builder spilled about 640px past the screen and the tour still ran.

**After:** below 768px the page says "The designer needs a bigger screen" and offers View page and a way back to the page editor, where words and pictures can still be changed (`ten-builder-narrow-ml.png`).

**Test:** `PageDesignPage.test.tsx`, "says the designer needs a bigger screen on a phone…".

## Builder: Insert

**Before:** sections were tiny abstract thumbnails; what each was for only showed on hover.

**After:** each section is a card with a full-width sketch, its name and a two-line description; elements keep their compact rows and hover cards (`ten-builder-insert-dl.png`).

**Test:** `panels.test.tsx`, "opens on ready-made sections…".
