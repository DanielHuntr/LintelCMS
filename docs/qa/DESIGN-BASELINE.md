# Lintel admin: design baseline (1.0.0-rc.1)

Observed on 2 Nov 2026 from real screens (screenshots in `screenshots/`) and the tokens in `packages/admin/src/styles.css`.

**Status of these rules:**

- They describe what exists.
- They are the reference for judging inconsistencies.
- They are **not** new design rules.
- Patterns seen on only one screen are marked as such.

## Foundations

| Aspect    | Convention (source)                                                                                                                                                                                                                                                                       |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack     | React + Vite, Tailwind v4 with `@theme` tokens in `styles.css`; icons from lucide-react; strings through `t()` (`i18n/strings.ts`)                                                                                                                                                        |
| Type      | System stack (`-apple-system`, Segoe UI, Inter). Scale: display 38, large-title 34/700, title 22/600, headline 17/600, body 15, footnote 13, caption 12. Page titles use large-title; card titles use headline                                                                            |
| Radius    | Control 8px, card 12px, panel 14px (the sidebar and the content-tree panel)                                                                                                                                                                                                               |
| Shadow    | Used sparingly: `--shadow-float` for popovers and floating panels, `--shadow-thumb` for segmented-control knobs. Cards are flat white on a `#f5f5f7` background, with no border                                                                                                           |
| Colour    | Neutral greys (label `#1d1d1f`, secondary `#6e6e73`, separator `#d1d1d6`); a single violet accent for primary actions, selection and links. Semantic colours: red for destructive (Delete discount), amber for warning banners (Updates), green and others only as icon tiles in Settings |
| Dark mode | True black background, dark-grey cards, the same accent (`30-content-dark.png`, `31-products-dark.png`, `32-dashboard-dark.png`)                                                                                                                                                          |

## Layout patterns (repeated across screens, so deliberate)

- **App shell:**
  - a floating rounded sidebar panel, about 240px, with brand + site name, Search (Ctrl K), nav items with icons, and an account footer;
  - a help "?" button at the top right of the content area.
- **Page header:**
  - optional back link ("< Settings", "< Shop") above the large-title h1;
  - a one-line secondary description below it;
  - the primary action at the top right (filled violet: "New content type", "Add product", "Create"; tinted violet: "Edit dashboard", "Check now").
- **Settings index:** grouped list rows (coloured icon tile, title, one-line description, chevron) inside white rounded groups with small grey group labels (`17-settings.png`). The same row style is used in the Content types list (`12-content-types.png`).
- **Content workspace:** three columns: sidebar, a resizable tree panel (filter box, "CONTENT" and "SITE-WIDE" small-caps headings, + button, Recycle bin pinned to the bottom), and the work area (`64-content-tree-pages.png`).
- **Empty states:** a centred circular grey icon, a bold one-line title, a secondary sentence, and an optional single action (Dashboard widgets, Products, Customer orders).
- **Segmented controls:** pill segments for filters and modes (Products status filter; Updates "Stable / Betas too"; discount "With a code / Automatically"; "Everything / Some products / Some collections").
- **Choice cards:** large selectable cards with an icon tile and a check indicator. Seen **only** on the setup "What are you building" screen and the discount "What it gives" screen. They are acceptable for one-off decisions and should not spread to frequent settings.
- **Forms:** filled grey inputs (no border), label above, help text below in footnote grey.
- **Builder (full screen):**
  - a top bar with back + page title, Desktop/Tablet/Phone segments, undo/redo/history, Tools level, Edited state, View page, Publish;
  - a left panel with Layers/Insert tabs and search;
  - the right panel has Style/Content/Animate tabs with collapsible groups and pill option buttons (`71-builder-header-footer.png`).

## Website (built-in theme)

- Plain header with the site name and a hairline divider.
- Light-grey footer.
- Violet accent buttons.
- `--lintel-*` CSS variables in `packages/builder/src/render/elements/element-stylesheet.ts`.
- Drawers use `.lintel-drawer`, displayed only when `[open]`. This is the established pattern; `.lintel-cart` breaks it (LINTEL-FUNC-001).

## Existing inconsistencies (observed, not rules)

| Observation                                                                                                                                   | Screens            | Note                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Content width varies: Settings index and Updates are about 670–720px, the Discount editor about 770px, Content types and Dashboard full width | 17, 21, 63, 12, 10 | May be deliberate (forms narrow, lists wide). Content types is a list but has single rows; needs a design decision, not a fix |
| "Commerce" (sidebar) vs "Shop" (back link, "Shop settings")                                                                                   | 31, 26             | LINTEL-UX-002                                                                                                                 |
| The site switcher sits in the sidebar ("Working on") once a second site exists; the guide says it is at the top of the content tree           | 60, 64             | Documentation vs implementation; SPEC                                                                                         |
| Primary-action style differs between filled ("New content type") and tinted ("Edit dashboard", "Check now")                                   | 12, 10, 21         | Probably deliberate: tinted for secondary page-level actions. Keep as a rule only if confirmed by the design owner            |
| Phone width: there is no small-screen navigation pattern                                                                                      | 40–42              | LINTEL-UX-001; a defect, not a convention                                                                                     |

## Representative screens reviewed

1. Dashboard: `10-dashboard.png`.
2. Content tree: `11-content-tree.png`, `64-content-tree-pages.png`.
3. Content types: `12-content-types.png` (the editor itself was not opened).
4. Visual builder: `70-builder-empty.png`, `71-builder-header-footer.png`.
5. Media: `13-media.png`.
6. Commerce: `14-commerce-home.png`, `15-commerce-products.png`, `27-orders.png`, `28-customers.png`, `60-customer-ada.png`.
7. Settings: `17-settings.png`, `25-settings-features.png`, `26-shop-settings.png`.
8. Users: `18-users.png`.
9. A complex form: discount editor `63-discount-edit.png`, `67-discount-collections-scope.png`.
10. Setup wizard: `00-03`.
11. Website: `50-site-product-page.png`, `54-site-cart-with-items.png`.

**Not reviewed:**

- the page editor (entry form);
- the content-type field picker;
- modals and context menus;
- the page editor's preview panel.

These are the first items for the next visual batch.
