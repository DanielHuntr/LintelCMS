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
| Builder: Style     | `5d2c33e`, latest    | The panel shows the element's real size, weight and alignment; pixel sizes for designers only   |

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

## Builder: the style panel shows the real look

**Before:** the panel read only what was set on the element, so a heading the template made giant, bold and centred read "Normal" (or no size at all, for a size that grows with the screen), "Regular" and "Left". Beginners also saw "Grow with the screen" with pixel boxes.

**After:**

- The canvas measures the selected element (alignment, size, weight, colour) and sends it to the builder (`look` in `canvas-messages.ts`, checked like every other message).
- While nothing is set, or a set size matches no chip, the Text choices show the chip nearest the measured look (`style-panel/canvas-look.ts`): the Hero title reads Giant, Bold, Centre (`ten-builder-style-dl.png`, `-dd.png`).
- "Grow with the screen" is in Advanced only; the chosen colour's name shows beside the swatches.

**Tests:** `canvas-look.test.ts`, `advanced-styling.test.tsx` (beginners don't get pixel sizes; Advanced does).

**Still to polish:** in dark mode the darkest text swatch is hard to see against the panel.

## LINTEL-UX-009: the shop looks open before it can sell

**Before:** with no payments or no delivery price, the website still offered "Add to basket"; shoppers filled a basket and only checkout said no. Nothing on the website linked to the shop. The Shop home said what was missing three times (a warning box, the checklist and a count at the bottom), in warning orange, for what is the normal state of a new shop (`shop-home-before-dl.png`).

**After:**

- Until a market's payment provider is connected and some delivery zone has a price, the storefront gives every product `comingSoon: true` with nothing for sale (`shop-readiness.service.ts`). The website's cards and product pages say "Coming soon" instead of "Sold out" or "Add to basket" (`shop-coming-soon-*.png`, `shop-product-coming-soon-md.png`).
- The Shop home has one setup card: why it matters ("Your website shows your products as "Coming soon" until these are done"), a progress bar with "2 of 4 done", only the steps left, and finished steps folded into one line (`shop-home-after-*.png`).
- An optional step adds Shop to the end of the main menu in one press, while that menu is arranged by hand and has no link to `/shop` (`shop-menu-added-dl.png`, `shop-site-menu-dl.png`).
- The orange warning now only shows when a set-up shop still can't take payment (a market paying with a provider that isn't connected).

**Tests:** `shop-readiness.test.ts`; `elements.test.tsx` ("says coming soon, not sold out…"); `ShopScreens.test.tsx` (the setup card, the warning after setup, adding Shop to the menu).

## LINTEL-UX-014: a menu with a link to a deleted page can't be saved

**Found while checking UX-009:** pressing "Add Shop to your main menu" failed with "Some fields need attention: - b28dee45-…: The page this item linked to has been deleted". The main menu had a link to a page that had since been deleted, and the API refuses the whole menu.

**Fix:** the Shop step says "One link in the menu goes to a page that was deleted, so it'll be taken out at the same time." and leaves it out when it saves. Checked in the browser: the menu saved and the website's menu reads "Home | Shop".

**Test:** `ShopScreens.test.tsx`, "says a link to a deleted page will go, and takes it out so the menu saves".

**Still open:** the menu editor itself shows the same error with the id when this happens; it should name the link and offer to remove it.

## LINTEL-UX-015: Settings grouped by what each setting is for

**Before:** "Your website" (template, colours, fonts, logo) and "Branding" (name, logo and colour) sat in different groups, so a client could open the wrong one. Content types and Features, set up once by whoever built the site, were second and third. The group names didn't match each other ("Site", "How the admin looks", "Your site's data", "Websites and apps"), icon colours meant nothing, and descriptions were cut off on a phone (`settings-before-dl.png`).

**After** (`settings-after-*.png`):

- **Your website:** Look and address, Languages, Search engines.
- **Security and email:** Security log, Email outbox.
- **Backups and moving:** Backups, Import and export.
- **Set up by whoever built your site:** Content types, Features, Websites and domains (was Sites), Admin branding (was Branding: "The name, logo and colour your clients see in the admin"). A note under it says to check with whoever built the site first.
- For developers, then Lintel itself.
- One icon colour per group; descriptions wrap.
- Interface language moved to Account, since it's your own choice; its page goes back to Account.

**Tests:** `SettingsPage.test.tsx` ("groups settings by what they're for…"), `AccountPage.test.tsx`.

**Still to do (Phase C):** one "Look and feel" place for template, colours, fonts and logo, bringing Design and Your website together.

## LINTEL-UX-016: Account titled "Create your account"

**Found while checking UX-015.** Strings files are spread into one list, so a key defined in two files took whichever came last:

- Account showed the setup screen's "Create your account" and its subtitle (`account-before-dl.png`).
- An entry's automation review section was titled "Check your details".
- The automation builder's loading text said "Loading the content type".
- The automation gallery's button read "Use this template".

**Fix:** setup and automation strings have their own keys (`createAccount.*`, `workflowBuilder.loading`, `workflowReview.title`, `workflowTemplates.use`); duplicate "Save"/"Saving…" keys removed (`account-after-dl.png`, `-md.png`).

**Tests:** `i18n/stringKeys.test.ts` fails if any two strings files share a key; `AccountPage.test.tsx` checks the title.

## LINTEL-UX-017: Settings was a catch-all

**Before:** after UX-015 Settings was tidier but still held five kinds of thing: the website's details, logs (security log, email outbox), tools (backups, import, updates), the admin's language, and what the agency builds with (content types, features, sites, branding, API access, webhooks) (`move-settings-before-dl.png`).

**After:** each kind has its own home.

- **Settings** keeps what a website owner changes: Look and address, Languages, Search engines, then Backups, Updates and About under "Looking after your site" (`move-settings-after-*.png`).
- **Build**, a new sidebar item, holds how the site is put together, in three groups (`move-build-*.png`). Only people who can change the site's structure see it (any of `blueprints:update`, `settings:update`, `branding:update`, `content:transfer`), so Editors don't.
- **Users** has a Security log button; the security log goes back to Users and links owners to "Emails sent" (`move-users-dl.png`, `move-security-log-dl.png`).
- **Account** has the interface language (from UX-015).
- **Old addresses still work.** `/settings/webhooks/…` and the rest send people on to the new address, under the admin's own path too (`navigation/movedPages.ts`). Searching Settings for a moved screen says where it went: "Content types is now in Build" (`move-settings-search-dl.png`).
- **Directions updated.** 103 "Settings → …" directions in the help pages, READMEs and the server's own messages now point to the new place, and the Getting around page lists Build.

**Tests:** `movedPages.test.tsx` (old addresses go on, with the `/admin` path), `BuildPage.test.tsx`, `SettingsPage.test.tsx`, `SecurityLogPage.test.tsx` (owner-only "Emails sent", SEC-001 kept), `sections.test.ts` (who sees Build), `documentTitle.test.ts`.

## LINTEL-UX-018: Lintel moves from violet to blue

**Before:** the admin's tint was a bright violet (`#7539FD`) with lavender tints behind buttons. Next to the iOS-style lists it read as a generic template rather than a crafted iOS app. Daniel compared four tints on real screens (`tint-compare-shop.png`, `tint-compare-settings.png`) and chose to rebrand to blue.

**After:** Lintel blue `#0071E3` for buttons and the mark, `#0066CC` for text on light backgrounds and `#4AA3FF` on dark ones. All three pass WCAG AA, and `accent-colours.test.ts` now checks that (`blue-shop-*.png`, `blue-content-*.png`).

- The admin's tokens, the default admin branding (white-labelled admins keep their own colour), the builder's selection outline, the motion editor's highlight and the "Coming soon" placeholder page.
- The logo files in `brand/`, every PNG icon (admin, docs site, brand folder, Next.js starter), the docs site's favicon and mark, and the brand guide.

**Not changed, on purpose:** the default brand colour of client websites (`site-components` theme, `color-brand` token). Changing it would recolour live sites that never chose a colour. Example colour codes in hints still say `#7539fd`; they're only examples.

## LINTEL-UX-019: widths, headings and hover

Reported by Daniel from screenshots.

- **Security log width:** it stopped at 896px however wide the window was; it now uses the full width (`SecurityLogPage.test.tsx`).
- **Table headings:** browsers centre `<th>`, and headings don't inherit the table's `text-start`, so they sat off-centre over left-aligned columns. A base rule in `styles.css` lines every table's headings up with their columns.
- **Users:** the header's three buttons sat at the far right while the list stopped at 768px. The page is now one iOS-style column: only "Invite someone" stays in the header, Roles and Security log are rows in an "Access" group, "It's just you so far" is the People group's footer, and the search spans the column (`users-after-*.png`).
- **Row hover:** `bg-fill/60` on a white row came out almost exactly the page colour, so a hovered row looked like a hole in the card. Rows now hover a step lighter than the iOS pressed grey, and press to the full grey (`row-hover-dl.png`, `-dd.png`).

## LINTEL-UX-020: ink, paper and a title face of its own

**Before:** after UX-018 the admin was a clean iOS-style app in blue, but nothing about it was Lintel's own. Daniel compared title typefaces (`flair-compare.png`, `flair-sans-compare.png`) and then ink against blue (`ink-compare.png`), and chose ink and paper with Schibsted Grotesk titles and no underline beneath them.

**After** (`ink-users-*.png`, `ink-shop-*.png`, `ink-content-*.png`, `ink-settings-*.png`):

- **Ink** (`#1F1D1A`) for buttons, selection and the mark. Colour now comes only from the icon tiles (green Orders, orange Customers and so on).
- **Paper:** a warm `#F6F4EF` page with `#FFFEFB` cards, warm separators and fills. Dark mode is a warm near-black, and ink and paper swap (paper buttons with ink text).
- **Page titles** in Schibsted Grotesk extra-bold, bundled from `@fontsource` (OFL; licence in `src/fonts`), so they look the same on Windows and Mac. Everything else stays in the system font.
- **Text links are underlined,** since ink text alone doesn't look clickable (21 links).
- The default admin branding, the logo files, every icon, the docs site, the Next.js starter's icon and the brand guide move from blue to ink.

**Kept blue on purpose:** the builder's selection outline on the website canvas. It's a tool colour that has to show on any website, dark sections included.

**Tests:** `accent-colours.test.ts` (Lintel ink's shades), `branding.test.ts`.

## LINTEL-FUNC-028: dragging from Insert onto the page

Reported by Daniel: "I can't drag and drop the block."

**Reproduced:** dragging Product grid from Insert onto the canvas left the page unchanged (20 elements before and after, `canvas-drop-before.png`). Insert tiles only ever dropped into Layers; the canvas frame had no drop handling at all, and the hint said "drag it into Layers".

**Fix:**

- While an Insert tile is dragged over the page, the canvas frame reports where the pointer is in the element under it and in each one around it (`insertOver`, checked like every other frame message).
- The builder works out where it would land with the same rules as Layers (`canvas/canvas-drop.ts`), and the frame draws a line there: across the page, or upright beside an element in a row, or a dashed box for "inside" (`canvas-drop-line.png`).
- An element that can't take what's dragged hands the drop to the one around it. A whole section always goes between the page's sections. Below everything, it goes at the end.
- On release it's inserted there and selected (`canvas-drop-after.png`). The hint now says "drag it onto the page or into Layers".

**Tests:** `canvas-drop.test.ts` (inside, before and after, sections between sections, handing up, the end of the page), `canvas-messages.test.ts`. In the browser, Playwright's mouse can't carry an HTML drag into a frame, so the check starts a real drag on the tile and sends the frame the browser's own drag events: 20 elements, then 22 after one drop, then 24.

**Follow-up (FUNC-028 reopened by Daniel: "cursor not allowed"):** the first fix relied on drag events reaching the canvas frame, and the browser check sent those events straight into the frame. A truly native drag, driven through Chrome's own input (DevTools `Input.dispatchDragEvent`), showed that browsers don't deliver a drag from the builder into the sandboxed frame at all: neither the builder nor the frame saw it over the page, hence "not allowed". Now, while something from Insert is dragged, a transparent layer over the canvas catches the drag in the builder and sends the frame the pointer's position (`insertPoint`). The frame answers with what's under it, the line is drawn as before, and the drop is handled by the builder. Checked with a native drag: Product grid, 20 elements then 22; the "Story with key points" section, 20 then 28, placed before the hero where the line showed (`canvas-drop-native-line.png`, `canvas-drop-native-after.png`). Test: `Canvas.test.tsx`.

## LINTEL-UX-021: drag elements to a new place on the page

Asked by Daniel once dropping from Insert worked: "shouldn't I be able to move it here too?"

**Before:** on the canvas, only elements in a free layout could be dragged (to a pixel position). Everything else had to be moved in Layers.

**After:** press any element and drag a few pixels: it fades in place, the same line as for Insert shows where it would go, and letting go moves it there and keeps it selected (`canvas-move-during.png`, `canvas-move-after.png`). The same rules as Insert apply (a section goes between sections; something an element can't hold goes beside it), it never goes inside itself, locked elements stay put, and Escape calls it off. A plain click still selects, double-click still edits text, and free layouts keep their pixel dragging.

**Tests:** `canvas-messages.test.ts` (move messages). In the browser, with the real mouse inside the canvas: the first section dragged below the second swapped them, and a click afterwards selected without moving anything.

Also fixed: `Canvas.test.tsx` (added with FUNC-028) used a screen size that doesn't exist, which broke the builder's typecheck.

## LINTEL-UX-006: status brought up to date

Fixed in Phase A (`16f51ff`): fields a page's design replaces (Body, Sections, Blocks) sit behind a tinted note, "Body isn't shown on your website, because this page has a design", with "Show them anyway" (`designReplacedFields.ts`). The bug report still said Open; it now says Fixed.

## LINTEL-UX-022: one editor for creating and editing

Raised by Daniel: "+ Create" opened one editor (fields with a side panel, Publish at the top) and opening a page from the tree another (tabs for Content, Settings, History and Info, and a bar along the bottom). He asked for it to work like Statamic.

**After:** one editor for both (`editor-new-*.png`, `editor-existing-*.png`):

- **Along the top:** breadcrumbs (Pages › Home), then View page, Preview, the side panel toggle, a "…" menu and the main button. On a phone, View page and Preview show as icons so Publish stays in view.
- **The document:** title, address (the home page shows "/" rather than a slug it doesn't use) and the fields, a page's design first.
- **The side panel:** status with Schedule and Unpublish, translations, parent page, "In the main menu", search engines and history.
- **Details** (address, who made it, its id, what links to it) are under "…" (`editor-details-dl.png`). A page that lists its children (a Blog page) has a "Content | Items" switch.
- **Kept from the workspace:** the tree updates as you save and publish, publishing under an unpublished parent asks first, and saves send only what changed (never the parent).
- **A live page with nothing new says "Live on your site"** instead of a greyed-out "Published" button.
- **A new page can't be published until it has a title.**
- Nothing swaps over after the first save any more: it was always the same editor. The workspace's components are removed.
- **Sparkle icons replaced:** "Start designing" (pen and ruler), a suggested redirect (lightbulb), "Start from blank" (blank page), "Suggest a password" (dice), the animation studio's empty state (waves).

**Also fixed, LINTEL-FUNC-024:** opening the preview or the items list asked "Leave without saving?". The leave warning now asks only when the page itself changes, not when only the address's query does. The regression test fails without the fix.

**Tests:** `OneEditor.test.tsx` (the workspace's tests, carried over, plus new ones), `EntryEditor.test.tsx`, `DesignFirstFields.test.tsx`, `columnValues.test.ts`.

## The effects library merged into the release

`phase-6/effects` (117 effects, the Effects tab, site-wide motion, ready-made animated elements) is merged. Its decision record is renumbered 0026. Both sides of every conflict are kept: the style panel keeps the real-look wrapper and gains effect previews and page weight; designed pages keep their own header and footer and gain effects. The admin no longer stops if the effect modules' list is missing or malformed. Checked in the designer: the Effects gallery opens, "Magnetic pull" applies, and the page weight reads "Effects: 1, adding 3.2 kB" (`effects-gallery-dl.png`).

## LINTEL-FUNC-029: canvas effects lose their first frame

**Found while merging effects:** the branch's own browser test "draws particles behind the content" failed every time. Setting a canvas's size erases it, and the ResizeObserver's first report repeated the size the effect had just set, so the first frame was erased. With full motion the next frame redraws it. For visitors who ask for less motion there is no next frame, so they saw nothing; frosted glass lost its frost the same way.

**Fix:** the shared surface (`effects/kit/surface.ts`) only resizes the canvas when its size changes, and particles, frosted glass and the liquid gradient redraw after a real resize.

**Tests:** the branch's particles test now passes, and a new one, "keeps the still frame for people who ask for less motion", fails without the fix and passes with it. All 37 motion browser tests pass.

## LINTEL-FUNC-030: reveals that start fully clipped never play

**Found in the designer test** (building ambitious real-world pages): two giant headings with "Mask reveal up" never appeared on the published page. Their animation sat paused at its first frame, `clip-path: inset(100% 0 0)`. Chrome's IntersectionObserver counts an element clipped to nothing as out of view (checked in isolation: clipped 0, plain 1), so the in-view trigger waited for ever. Mask reveal up, Mask reveal right, Section curtain and Section iris were all affected, on any page.

**Fix:** animations that clip their own element measure the element's box on scroll and resize (once a frame, until they've played) instead of asking the observer. Watching the container instead was tried and rejected: a tall container is always in view, so the reveal played before its words were on screen.

**Test:** `runtime.browser.test.ts`, "plays a reveal that starts fully clipped, once it's in view" (times out without the fix). All 38 motion browser tests pass.

## The designer test: findings for the designer push

Six ambitious real-world page designs (editorial, studio, lookbook, showroom, course launch, weddings) were rebuilt privately from the designer's own elements, with motion and effects, to find where the designer falls short. All six could be built; most came close. The copies are kept out of the repo. What to fix:

1. The site's header and footer always show on a designed page unless it has its own Header: offer "hide the site's header and footer on this page".
2. Links are underlined by default, custom navigation included: link styles set once (design system classes or variables).
3. The carousel shows whole slides only: add "show part of the next" and free slide widths.
4. Most catalogue fonts come in regular and bold only: add thin and light weights for display fonts.
5. Giant type doesn't shrink on phones unless set by hand: fluid sizes on by default for the largest steps.
6. The Desktop canvas is about 800px wide, so free layouts reflow in the designer: true widths scaled to fit, side-by-side breakpoints.
7. The font menu shows raw CSS for fonts set in code: always the font's name.
8. Layers are named "Heading", "Paragraph": name them from their text or picture.
9. A full-screen hero is cut by the site header: "fill the screen below the header".
10. Free-photo search matches loosely: filter to photographs and offer several to choose from.

## Accessibility batch (4 November 2026)

Branch `fix/accessibility`. Each regression test was run on the unfixed code first and failed there. Screenshots are in `screenshots/fix-a11y/`.

### LINTEL-A11Y-001: the basket drawer didn't give focus back

- **Cause:** "Add to basket" is disabled while the request runs, which takes focus off it. So when the drawer opened, the browser had nowhere to return focus to.
- **Fix:** the button is ready again before the drawer opens, and gets focus back when the drawer closes.
- **Test:** `builder/src/browser-tests/shop-cart-focus.test.ts` uses Chromium, the real elements script and a stand-in shop API. After Escape, focus was `BODY` before and is "Add to basket" now.

### LINTEL-A11Y-002: checkout lost focus after "Choose delivery"

- **Same cause:** the busy button lost focus.
- **Fix:**
  - Focus moves to the chosen delivery option.
  - The status line says "2 ways to deliver. Choose one, then choose Pay now." (or "1 way to deliver…").
  - If the button loses focus any other way (an error, say), focus returns to it.
- **Tests:** the same browser file (focus was `BODY` before, the first rate now) and `cart-views.test.ts` (the message).

### LINTEL-A11Y-003: no reflow at 320px in the editors

- **Entry editor (368px wide at 320):** the sticky bar always reached 64px past the right edge, the room left for the help button on wider screens. Below 768px the page's own gutter is 16px.
  - The bar now follows the page's gutter.
  - Below 400px its buttons sit closer: no gaps, and 32px icon buttons.
- **Content type editor (368px):** the preview address box couldn't narrow (`flex-1` without `min-w-0`).
- **Measured at 320x256, after:** Content, the entry editor, the Page content type and Users are all 320px wide.
- **Screenshots:** [entry before](screenshots/fix-a11y/a11y-003-entry-before-320.png), [entry after](screenshots/fix-a11y/a11y-003-entry-after-320.png), [content type before](screenshots/fix-a11y/a11y-003-type-before-320.png), [content type after](screenshots/fix-a11y/a11y-003-type-after-320.png).

### LINTEL-A11Y-004: names that didn't contain the visible text (WCAG 2.5.3)

Each name now starts with what's shown:

- **Account link:** was "Your account: Sam Baker", while it also shows the email. Now it's "Your account: Sam Baker sam@bakery.test", from the visible text plus a hidden "Your account:".
- **Recycle bin:** the visible words plus ", 1 item" in hidden text. The bare count is hidden from screen readers.
- **Field cards in the content type editor:** were "Title settings". Now the card's own text, then "settings" ("Title Text · title settings").
- **Tree rows:** the count's description follows the name ("Blog posts, 240 …"), and the bare number is hidden.

**Tests:** `SidebarAccount.test.tsx` (new), `BlueprintEditor.test.tsx` and `ContentTree.test.tsx`.

**After:** the name check finds no mismatches on Content, the entry editor, the Page content type or Users. The exception is a page-tree section ("Pages"), whose text includes its child pages; that's how a tree is built.

### LINTEL-A11Y-005: low contrast

- **Field picker footer:** its hint used tertiary text (3.44:1 light, 3.29:1 dark). It's real text, so it now uses secondary.
- **Builder breakpoint switch:** the cause was secondary text on the grey control fill: 4.38:1 light and 4.29:1 dark. The secondary colour is now:
  - light: `#67625a`, which is 4.94:1 on the fill, 5.5 on the page and 6.0 on cards;
  - dark: `#b0a99f`, which is 4.71 and 5.25 on the fill over the two dark surfaces.
- **Test:** `admin/src/design/colourContrast.test.ts` reads `styles.css` and checks label and secondary label against every background, in both schemes.
- **Screenshots:** the field picker before and after, desktop and 390px, light and dark (`a11y-005-field-picker-*`).

### LINTEL-A11Y-006: the sticky header covered fields the browser scrolled to

- **Fix:**
  - The page keeps `scroll-padding-top` at the header's height.
  - The elements script measures the header (61px on desktop, 113px on a phone, where the menu wraps) and keeps the value current.
  - The site's header styles give 5rem, or 8rem on phones, where the script isn't loaded.
- **Test:** `builder/src/browser-tests/sticky-header-clearance.test.ts`. A form with a mistake sent from further down, and a link to a field, both left the field under the header before (its top at 1px, under a 113px header) and now leave it in view, with and without the script.

### LINTEL-A11Y-007: small tap targets on phones

- **Already gone:** the entry editor's 20px "Actions" button (the one-editor change).
- **Measured at 390x844, two standalone text controls were 18px tall:** "Show them anyway" and "Open the main menu". Both now have a 24px minimum.
- **Left as they are, under WCAG 2.5.8's exceptions:**
  - The breadcrumb link (17px): it sits in a line of text.
  - The content type editor's field width handles (12px): the width can also be set in each field's settings and with the arrow keys.
  - One 16px checkbox: its label is clickable.

## LINTEL-UX-023: two navs on a page with its own header (4 November 2026)

**Found by Daniel** on a designer-test page: the site's header ("Sam's Bakery · Home · Shop") showed above the page's own nav.

**Cause:**

- A page replaces the site's footer with a section drawn as `<footer>`, but the header had no equivalent: only the Header element counted.
- A nav built from a plain section is a separate gap, and stays one. A clear "Hide the site's header and footer on this page" setting is planned for the designer push (step 9, designer-test finding 1).

**Fix:**

- A visible top-level section drawn as `<header>` now replaces the site's header.
- When added from Insert, it goes to the top of the page, as footer sections go to the bottom.

**Test:** `builder-model/src/components/site-chrome.test.ts`. Two of its three cases fail on the old code.

## LINTEL-UX-024: one Motion panel instead of Animation and Effects tabs (4 November 2026)

**Daniel's finding:** the Animate panel "feels a bit clunky and hard to grasp".

- It had two tabs (Animation, Effects), and tabs inside them (Presets, Simple, Advanced).
- "Effects: 1, adding 11 kB" sat next to "No effects yet".
- Filters came before any choice, the effect cards all looked alike, and "when it plays" was folded away at the bottom.

**Redesign:** agreed through clickable mock-ups (Motion panel, then the real library, then states).

`@lintel/motion-editor` has a new `MotionPanel` (`src/motion-panel/`), and the builder's Animate tab now shows only that:

- **One list** of what moves, the animation and the effects together, each named by what it does and when ("Words rise · When it appears"). Point at a row to watch it on the page. Play is in the header.
- **Add motion** asks "When should it move?": Appears, Hover, Click, Scroll, Always.
  - Each moment lists its choices in plain groups, such as "Words", "Depth and 3D" and "Backgrounds".
  - A search box covers every moment at once.
  - All 42 presets and the element effects are sorted in (`motionChoices.ts`). Only effects that suit the element are offered. Page exits, cursors and page transitions stay in the site-wide settings.
  - Pointing at a choice plays it on the element on the page.
- **Editing:**
  - An animation opens straight in the studio's Simple view, with Advanced (the timeline) for Designers. Beginners see the note about switching to Designer.
  - An effect shows its settings in plain words.
  - Remove is at the bottom.
- **Page weight** is only shown when there's something to warn about.
- **Still one animation per element:** choosing another replaces the current one, and the panel says so. Several per element is part of the designer push.

**Tests:**

- `motion-editor/src/motion-panel/motionChoices.test.ts` (new): sorting, groups, suitability, search.
- `builder/src/animate-panel/effects-tab.test.tsx`: adding by moment, the arrow keys, search, editing and removing, animation effects.
- `studio.test.tsx` and `panels.test.tsx` updated for the new flow.

**Checked in the running builder** at desktop and 390px, light and dark, with the Hero title selected: `screenshots/motion-panel/`. Daniel's screenshots of the old panel are the before.

## LINTEL-UX-025: states and scroll scenes, part 1 (4 November 2026)

Daniel compared the motion with Framer and Webflow: Framer animates between states (a card's normal and hover, with what's inside), and Webflow and GSAP have full scroll triggers. Agreed through the states and scroll scene mock-ups.

**States**

- **The model:**
  - Element styles have a Pressed state (`:active`) beside Hover and Focus.
  - Styles can follow the state of an element around it, stored as `owners["hover@<id>"]` and drawn as `.card:hover .picture`.
  - An owner can have a `stateTransition` (Smooth, Springy or Instant, at a speed). Only the properties its states change are eased, and only for people who don't ask for less motion.
  - Copying a card points its picture's states at the copy.
- **The builder:**
  - "Style for" shows to everyone, with the element's own states and those of the three nearest elements around it ("Two halves: pointer over").
  - The canvas shows the state while it's being styled.
  - "Moving between states" sets the transition on the owner.
- **Tests:** `builder-model/src/styles/states.test.ts` and `builder/src/panels/panels.test.tsx`. Checked in the builder, with screenshots in `screenshots/states/`.

**Scroll scenes**

- **Smoothing:** `smooth` (0 to 2 s) lets a scene follow a moment behind the scrolling.
- **Snapping:** `snap` points make it settle on a step when scrolling stops. It moves the scene, never the page.
- **An action per direction:** in-view animations have one for entering, leaving, entering back and leaving back (play, reverse, restart, reset, pause, resume, finish, none).
- **Settings:** "Follows the scrolling", "Settles on" and "Scrolling back up past it" in the animation settings.
- **Start and End lines:** drawn on the canvas for the selected element's scene. Drag them, or move them with the arrow keys.
- **Tests:** browser tests for smoothing, snapping and directions (`motion/src/browser-tests/runtime.browser.test.ts`) and for the lines (`builder/src/browser-tests/canvas-free-layout.test.ts`). Each fails without its change. There are unit tests for the maths and the settings, and the animation spec reference is updated.

**Scene steps (4 November 2026):**

- A scroll animation can follow another element's scroll (`follows`, by node id) over part of its scene (`range`). The title, picture and numbers in a held section can each play their own step.
- In the settings: "Plays as this scrolls past" offers this element or the elements around it, with "Starts at" and "Ends at" as percentages of the scene.
- On the website, the followed element carries its id.
- Tests:
  - a browser test of a step in the second half of a section's scene;
  - unit tests for the maths and the settings;
  - a render test for the id.

**Several animations on one element (4 November 2026):**

- An element keeps `animations`, a list of up to six (an entrance, a hover, scroll steps), instead of one `animation`.
- Page documents are now version 2. Version 1 pages are migrated when read, with each `animation` becoming a list of one, so nothing in the database has to change.
- The Motion panel lists each animation, Play plays them all, and choosing one adds it rather than replacing.
- **Tests:**
  - `builder-model/src/document/migrations.test.ts` (new), and a limit test in `validate-page.test.ts`;
  - in the builder: two animations kept, and removing one keeps the other;
  - the existing tests updated.
- **Docs:** the spec and effects docs updated.

**Open and selected states (4 November 2026):**

- **Open:** an element with open styles of its own, or that others follow ("Card: open"), carries `data-lintel-opens` on the website.
  - The elements script makes its first button (or the element itself, as a button) toggle `data-open` and `aria-expanded`.
  - Escape closes it and gives focus back to the button. A link inside is left alone.
- **Selected:** follows what's already marked current or chosen (`aria-current="page"`, `aria-selected`, `aria-pressed`), with no script.
- Both are in "Style for", for the element and for those around it.
- **Tests:** compiled selectors and `listOpeningNodes` (model), the website marker (render), the options (panels), and a real-browser test of opening, closing with Escape and focus going back (`browser-tests/open-states.test.ts`).

## QOL-A-1: Undo after deleting (3 November 2026)

**Asked for by Daniel:** after a page, an entry or a file goes to the recycle bin, a note says so with Undo, and Undo puts it back where it was.

**What changed:**

- **One note for the whole admin:** `design/Toast.tsx`. It is a polite live region, Alt+T takes keyboard focus to Undo (screen readers hear that in the note), and it stays about 8 seconds, longer while the pointer or keyboard focus is on it. Checked in Chromium: Alt+T, then Enter, undid a media delete, and the note stayed past 9 seconds while focused. The content tree's note is the same component, placed at the foot of the tree.
- **Content tree, one page:** "Moved “About” to the recycle bin. Undo" (it used to say "“About” is in the recycle bin." with no Undo). Undo reopens the page if the workspace was showing it.
- **Content tree and list, several pages:** the existing Undo now puts them back as they were too.
- **Entry editor:** Delete now moves the entry to the recycle bin (it deleted for good before, and said "This can’t be undone"), goes back to the list and offers Undo, which reopens the entry.
- **Media library:** Delete moves the file to a new media recycle bin and offers Undo. The Recycle bin screen has a Files group with Restore and Delete for good; Empty empties both.
- **Undo is a real undo:** `POST /recycle-bin/:id/restore` with `asBefore: true` puts an entry back in its old place, live again with what it showed when the person may publish. See `docs/decisions/0030-undo-after-deleting.md`.
- **Fixed on the way (LINTEL-UX-026):** the tree's note said it stayed while hovered or focused, but its timer ran regardless, and restarted whenever the tree re-rendered.

**Tests:**

- core: `recycle-bin/recycle-bin.test.ts` (Undo in place and live; a draft for someone who can't publish), `media/media-bin.test.ts`, `media/media-library.test.ts`.
- admin: `design/Toast.test.tsx`, `content-tree/RecycleWithUndo.test.tsx`, `content-tree/RecycleBinPage.test.tsx`, `content/EntryEditor.test.tsx`, `media/MediaLibraryPage.test.tsx`, `content-workspace/CollectionView.test.tsx`.
- Migration `0025_media_recycle_bin` checked on a fresh database (the tests) and on one made before it (the browser check's, set up on the release code first).

**Screenshots** (`screenshots/qol-a/`):

- before: `f1-before-tree-delete-note`, `f1-before-editor-delete-dialog`, `f1-before-media-delete-dialog`;
- after, each at desktop and 390px, light and dark: `f1-after-tree-delete-undo-*`, `f1-after-tree-undone-*`, `f1-after-editor-delete-dialog-*`, `f1-after-editor-deleted-toast-*`, `f1-after-media-delete-dialog-*`, `f1-after-media-deleted-toast-*`, `f1-after-recycle-bin-files-*`; `f1-after-media-toast-keyboard-desktop-light` (Undo focused with Alt+T).

## QOL-A-2: actions in the command palette (3 November 2026)

**Asked for by Daniel:** Ctrl K (⌘K) finds pages and media; it should also do things.

**What changed:**

- **An Actions group** (`search/paletteActions.ts`) lists what matches the words typed: "New page", "New entry in <collection>", "Upload media", "Open Settings", "Open Build", "Invite someone", "Switch to dark mode" (or light), "Match my device’s light or dark setting" (once someone has chosen) and "Sign out". Each also answers to a few everyday words: "create", "log out", "theme".
- **Only what the person may do:** the same permissions as the screens behind them (`entries:create`, `media:upload`, the Settings and Build sections' rules, `users:invite`).
- **Order:** places to go, then actions, then content and media. "Settings" under Go to is left out when "Open Settings" is offered, so nothing is listed twice. The combobox keys are unchanged: arrows, Ctrl+Home/End, Enter and Escape.
- **Upload and Invite open their screens ready:** `/media?upload=true` opens the file chooser, and `/users?invite=true` opens the invitation. Both clear the address afterwards, so a reload doesn't ask again.
- **Light and dark** (`src/appearance`): the admin follows the device, as before, unless someone chooses from the palette. The choice is this browser's and is applied before the first screen is drawn.
- **Fixed on the way (LINTEL-UX-027):** the dashboard's "Add images and files" asked for `media:create`, which no role has, so Authors (who may upload) never saw it. It now asks for `media:upload`.

**Tests:** `search/paletteItems.test.ts`, `search/CommandPalette.test.tsx`, `appearance/colorScheme.test.ts`, `people/UsersPage.test.tsx`, `media/MediaLibraryPage.test.tsx`, `dashboard/DashboardPage.test.tsx` (fails on the old code).

**Checked in Chromium:**

- "new" then Enter opens a new page.
- "dark" switches, and the choice survives a reload; "Match my device" clears it.
- "invite" opens the invitation, and "upload" opens the file chooser.
- "log out" signs out.

**Screenshots** (`screenshots/qol-a/`):

- before: `f2-before-palette-new`;
- after: `f2-after-palette-new-*` (desktop and 390px, light and dark), `f2-after-palette-dark-mode`, `f2-after-palette-theme-when-dark`, `f2-after-palette-settings`, `f2-after-invite-opened`, `f2-after-palette-sign-out`.

## QOL-A-3: choose a page for a link (3 November 2026)

**Asked for by Daniel:** wherever a link's address is typed, offer a page picker that finds pages by title.

**The format it inserts:** the page's address on the site, such as `/about`. Outside menus, Lintel has no link-by-id format, so nothing new was invented. An address starting with `/` is the form these places already take for a page on the site: the builder's hint says "a page on your site such as /about", and Link fields and rich text accept it. The cost is that a link doesn't follow the page if its address changes later. With the SEO tools on, Lintel offers a redirect when an address changes. A by-id format (resolved when the site is drawn, as menus are) would need a decision record; see the report.

**What changed:**

- **"Choose a page…"**, a plain text action, opens a dialog (`admin/src/page-links`) that searches pages by title. Each result shows its address on the right. Entries without a page of their own aren't offered.
- **Where it appears:**
  - the rich text link form, which links the selected words or inserts the page's title, linked;
  - Link fields, which fill in the address, and the link text when there is none;
  - the builder's Content panel, for every element with a link (buttons, links, cards, pricing, social links and the rest) and for each address in a list of links.
- **Unchanged:** typing a full web address still works everywhere. Menus already link to pages by id ("Choose page") and are left as they are.
- **API:** `GET /content-tree/search` now gives each result its `url`.

**Not covered:** the builder's inline text links (the small bar over selected words on the canvas), because a dialog takes focus from the text being edited; URL fields, which are for web addresses; and the redirect target in SEO tools.

**Tests:**

- `admin/src/page-links/PagePicker.test.tsx`: Link fields and rich text, end to end against a mocked API.
- `builder/src/panels/page-picker.test.tsx`.
- `core/src/content-tree/content-tree.test.ts`: addresses in search results.

**Checked in Chromium:** picked pages fill `/about/our-story` in a Link field, `/opening-hours` in rich text and `/contact` on a builder button.

**Screenshots** (`screenshots/qol-a/`):

- before: `f3-before-link-field`, `f3-before-richtext-link`, `f3-before-builder-button-link`, `f3-before-menu`;
- after, at desktop and 390px, light and dark: `f3-after-picker-*`, `f3-after-link-field-*`, `f3-after-richtext-link-form-*`, `f3-after-richtext-linked-*`;
- after, desktop light and dark only (the builder is desktop-only, LINTEL-UX-013): `f3-after-builder-picker-*`, `f3-after-builder-button-link-*`.

## LINTEL-UX-028: free photos from Openverse (3 November 2026)

**Asked for:** a way to find free photos without leaving Lintel.

**What it does:**

- A new optional feature, **Free photos**, off until it's switched on in Build → Features.
- While it's on, the media library has a **Free photos** button beside Upload, and the image picker has one beside Upload new.
- Searches go through Lintel's API to Openverse's public API, never from the browser. Only signed-in people who may upload files can use it.
- Each result shows its title, creator and licence, with a link to where it's from. Only licences a business can use without asking are offered: CC0, Public Domain Mark, CC BY and CC BY-SA. NC and ND licences never show.
- **Add** downloads the photo on the server and stores it as a normal file. Its credit (title, creator, licence and source) goes in the file's new **Credit** field, which shows in the file's details and can be edited.
- In the image picker, **Use** adds the photo and chooses it.

**Safety and polite use:**

- The download goes through the same address checks as webhooks, so private and local addresses are refused, after redirects too.
- Requests name Lintel in their user agent and give up after 8 seconds.
- Searches are kept for 10 minutes and thumbnails for an hour, so paging back doesn't ask Openverse again.
- Openverse's "too many searches" answer becomes a plain message.

**Migration:** `0026_asset_credit` adds `assets.credit` (empty for existing files). Checked on a fresh database and on one built with release fd4ee02's migrations (to 0025) with a file already in it.

**Tests:**

- `core/src/free-photos/free-photos.test.ts`, against a stand-in Openverse. It covers switching on, permissions, licences, the cache, plain errors, thumbnails, adding with the credit, adding twice, a refused licence and a refused private address.
- `core/src/media/media-library.test.ts`: saving a credit.
- `admin/src/free-photos/FreePhotosDialog.test.tsx`: searching, adding, a gone photo left out, a failed search, and the button showing only while the feature is on.

**Screenshots** (in `screenshots/qol-b/`): `photos-features-desktop-light`, `photos-start-desktop-light`, `photos-results-*` (desktop and 390px, light and dark), `photos-added-desktop-light`, `photos-credit-desktop-light`.

## LINTEL-UX-029: paste or drop pictures where they're used (3 November 2026)

**Asked for:** pictures pasted from the clipboard or dropped from the computer should work wherever a picture belongs, not only in the media library.

**What works now:**

- **Media library:** pasting anywhere on the page uploads, as dropping already did. Pastes into text areas and rich text are left alone.
- **Image picker:** pasting works there too, and the picture is chosen when it arrives.
- **Image fields:**
  - A picture dropped on the field, or pasted while it has focus, is uploaded and chosen.
  - The field says "or drop or paste one here", and "Drop to use this picture" while a file is over it.
  - Progress ("Uploading harbour.jpg… 40%") and problems ("“menu.pdf” isn't a picture…") show under the field.
- **Markdown fields:** a dropped or pasted picture is uploaded and written in as `![](address)` where the cursor was, with a note to describe it between the brackets.
- **Page builder:**
  - A picture dropped on a Picture element on the canvas becomes its picture (one Undo step), keeping its description.
  - Pasting with a Picture element selected does the same.
  - Dropped anywhere else, a note says pictures go into a Picture element.
  - Before, the frame let the browser open a dropped file in place of the page.
- Screenshots pasted without a usable name are called "Pasted picture 14.03.22.png".

Every upload uses the media library's upload and checks, and its plain messages.

**Left out: pictures inside rich text.** Rich text holds words, lists and links only. That's a choice recorded in `richTextExtensions.ts`, and core renders and checks the same list. A picture dropped or pasted there is now caught, rather than left to the browser, and a note says to use an image field or the page design. Adding pictures to rich text would change what rich text is, and what websites receive, so it's Daniel's call.

**Tests:**

- `admin/src/media/quickUpload.test.tsx`: the image field (drop with progress, paste, a non-picture), library paste, Markdown insertion, rich text's note, naming pasted files, and the builder's uploader refusing non-pictures.
- `builder/src/canvas/picture-drop.test.tsx`: dropping on a Picture element, elsewhere, pasting with nothing selected, a failed upload, no uploader, and checking the frame's file messages.

**Screenshots** (in `screenshots/qol-b/`):

- `drop-image-field-over-desktop-*`;
- `drop-image-field-after-*` (desktop and 390px, light and dark);
- `paste-markdown-*` and `paste-rich-text-*` (desktop and 390px, light);
- `paste-media-library-*` (all four);
- `drop-builder-wrong-place-desktop-*` and `drop-builder-picture-desktop-*`.

## LINTEL-UX-030: Compare with live (3 November 2026)

**Asked for:** when a published entry has unpublished changes, a way to see exactly what publishing will change.

**What it does:**

- The Status box in the entry editor still says "Unpublished changes". It now has **Compare with live** under that line.
- The dialog lists every field that differs from the live version, in the content type's order:
  - **Text and rich text:** the removed and added words, inline. Removed words are struck through and added ones underlined, each on a light tint, so colour isn't the only mark. Screen readers hear "removed:" and "added:" before each change.
  - **Pictures:** the live and the new picture side by side, with their names.
  - **Page designs:** "Design changed", with a link to view the live page.
  - **Choices, switches and dates:** "Live" and "After publishing" values.
  - **Blocks and other structured values:** "This changed".
- It compares what's in the editor with the stored `publishedData`. If a change is still waiting for autosave, the dialog says so.
- **API:** `GET /entries/:id/live` (`entries:read`) returns `{ publishedAt, data }`, where `data` is null while nothing is live. It's a separate endpoint so the entry itself, which every screen loads, doesn't double in size.

**Tests:**

- `core/src/entries/entry-publishing.test.ts`: the live version before and after publishing, and a 404.
- `admin/src/compare-live/compareLive.test.tsx`:
  - word comparison;
  - which fields count as changed, and how each is shown;
  - rich text read as words;
  - the dialog's marks and their spoken words;
  - the live-page link;
  - "nothing differs";
  - the button showing only while there are unpublished changes.

**Screenshots** (in `screenshots/qol-b/`): `compare-offer-desktop-light` and `compare-dialog-*` (desktop and 390px, light and dark).

## LINTEL-UX-031: a schedule calendar (3 November 2026)

**Asked for:** one place to see everything that's scheduled, by date.

**What it does:**

- **Schedule** sits at the foot of the content tree, above the recycle bin, and opens `/content/schedule`.
- **Wide screens:** a month calendar. Each day lists what's due to be published, with its title, time and collection, and each links to the entry. Today is filled in, and days from the months either side are shaded.
- **Phones:** a list grouped by day, showing only the days with something due. It uses inset grouped lists with the time on the right.
- **Moving between months:** Previous month and Next month, plus This month when you're elsewhere. The month is in the address, so it survives a reload.
- **An empty month** says how to schedule something.
- **Times** are in the person's own time zone, and the footer says so.
- **Screen readers** hear each day's full date and how many things are due.
- **Unpublishing:** Lintel only schedules publishing (`scheduledFor`), so there's nothing of that kind to show. The API marks each item `action: "publish"` so the calendar can show both if scheduled unpublishing is added.
- **API:** `GET /entries/scheduled?from=&to=` (`entries:read`, at most 62 days). It covers the site being worked on plus shared collections, soonest first.
- "schedule" is now a reserved collection handle, so a collection can't take the calendar's address.

**Tests:**

- `core/src/entries/scheduled-entries.test.ts`: range and order, an entry that's no longer scheduled, range checks, permissions.
- `admin/src/schedule-calendar/SchedulePage.test.tsx`: the month grid, entries on their days with links, moving months, the empty month, and the phone list.

**Screenshots** (in `screenshots/qol-b/`):

- `schedule-tree-link-desktop-light`;
- `schedule-*` (desktop and 390px, light and dark);
- `schedule-empty-month-desktop-light` and `schedule-empty-month-phone-light`.

## LINTEL-UX-032: photo credits on the website (3 November 2026)

**Asked for (decided with Daniel):** show a photo's credit where its licence asks for one. CC BY and CC BY-SA require it, and visitors and photographers expect it.

**What it does:**

- **Where it shows:** a picture whose media item has a credit gets a small line under it, such as "Photo: JeepersMedia, CC BY 2.0". The creator links to where the photo was found, and the licence to its terms. This covers the builder's Picture element, the image section that draws image fields, and Liquid's `{% image %}`.
- **Markup and styling:** it's drawn as `<figure>` with `<figcaption class="lintel-credit">`. When there's also a caption, the credit follows it in the same figcaption. It's small and in the theme's secondary text colour, so it follows light and dark themes.
- **Which photos:** CC0 and Public Domain Mark photos show nothing. A credit typed by hand counts as needed and shows as typed.
- **Switching it off:** the Picture element's Content settings have **Show the photo credit**. It's on by default, offered only when there's a credit to show, and says the licence asks for a credit when it's turned off. Liquid's `{% image %}` takes `credit: false`.
- **The canvas** shows the credit as the website will.
- **The delivery API** gives each image its `credit`, so headless sites can show it too.

**What's stored:**

- **Migration:** `0027_asset_credit_details` adds `assets.credit_details` (jsonb, null for existing files).
- **Free photos** keep the credit's parts there: licence code and name, licence link, creator and source.
- **Typing a credit by hand** clears the parts, so the site shows exactly what was typed.
- **Checked** on a fresh database and on one built with release da8e1ac's migrations with a file already in it.

**Tests:**

- `core/src/media/photo-credit.test.ts`: BY in parts, CC0 and PDM show nothing, typed credits.
- `core/src/free-photos/free-photos.test.ts`: added photos carry the website credit, and a PDM photo carries none.
- `core/src/media/media-library.test.ts`: a typed credit, and delivered assets carrying `credit`.
- `core/src/liquid-templates/liquid-engine.test.ts`: `{% image %}` with a credit, with `credit: false`, and without a credit.
- `builder/src/render/photo-credit.test.tsx`: Picture with a BY credit, with a CC0 photo, with the switch off and with a caption. Also the switch: on, its note when off, and hidden without a credit.
- `site-components/src/media/photo-credit.test.tsx`: the image section with a credit, a typed credit with a caption, and none.

**Screenshots** (in `screenshots/qol-b/`): `credits-site-desktop-light`, `credits-site-desktop-dark`, `credits-site-phone-light`, `credits-builder-on-desktop-light` and `credits-builder-off-desktop-light`.

## LINTEL-UX-033: choosing which look to change (3 November 2026)

**Reported by Daniel:** the Style panel's "Style for" dropdown "makes no sense, what does it do?". It mixed the element's own states with "Lookbook: pointer over" style entries for the elements around it, in one long list with jargon headings.

**Reproduced:** select a picture inside a card, open Style. The dropdown lists Always, then "This element" and "With what's around it" groups. Nothing says that it picks which look the changes below apply to.

**Fix:** the dropdown is now two plain questions at the top of Style.

- **Which look you're changing:** Normal, Hovered, Pressed, Focused, Open, Current, as buttons that are all visible at once.
- **What has to be hovered** (or pressed, open, current): this element, or one of the elements around it by name ("Two halves, around it"). It only shows once a look other than Normal is chosen. Focused has no second question, because focus is always the element's own. Moving between looks keeps following the same element around it.
- **A sentence in a tinted box** says what's being changed, with an example: "You're changing how this looks while the pointer is over Two halves, like a picture that grows when its card is hovered."
- The designer tour's text now names the looks instead of "Style for".

What's saved is unchanged, so existing pages keep their states.

**Tests:** `builder/src/panels/panels.test.tsx` checks the six looks in order and that Hovered saves to the hover styles. It also checks that the second question appears for Hovered, isn't there for Focused, and keeps the element around it when switching from Open to Hovered. It also covers the owner's transition. `studio.test.tsx` checks the tour text.

**Screenshots** (in `screenshots/looks/`): `before-style-for-desktop-light`, then `looks-normal-desktop-light`, `looks-owner-desktop-light` and `looks-owner-desktop-dark`. At 390px wide the designer shows its "needs a bigger screen" page, as before.

## LINTEL-UX-034: Insert search knows other names for elements (3 November 2026)

**Reported by Daniel:** "We don't currently have anything easy for like Carousels?" There is one, the Slider, but Insert couldn't find it.

**Reproduced:** in Insert, search "carousel". Nothing comes up, because search only looked at an element's name, description and group. "popup", "modal", "lightbox", "marquee", "faq" and "iframe" found nothing either.

**Fix:** element definitions can now carry `keywords`, the other names people know them by, and Insert's search reads them, as it already did for sections. 55 elements have them. For example: Slider has carousel and slideshow; Pop-up has popup, modal and dialog; Gallery has lightbox; Ticker and Logo strip have marquee; Accordion has faq; Embed has iframe; Menu drawer has hamburger.

**Tests:** `builder/src/panels/insert-library.test.ts` searches each of those words and expects the right element.

## LINKS-1: links to pages follow the page (3 November 2026)

**Asked for by Daniel:** a link made with "Choose a page…" should keep working when the page's address changes. QOL-A-3 stored the address (`/about`), so renaming or moving the page broke the link.

**Why it broke:** QOL-A-3 says so itself ("if the page's address changes later, the link doesn't follow"). On this branch, the check in Chromium did exactly that: "Our story" was the first page (`/`), a Home page was put above it, and its address became `/our-story`; the links on "Welcome" followed it.

**What changed** (decision record 0032):

- **Stored form:** `lintel:page/<entry id>`, in the place the address already went: a rich text link's `href`, a Link field's `url`, and the builder's link props. Helpers are in `builder-model/src/page-links`.
- **Resolved everywhere a link is drawn:** `deliverValues` swaps each for the page's address now, so the built-in site, previews, Liquid templates (`rich_text` and Link field values), the REST delivery API and GraphQL only ever see ordinary addresses. Rich text JSON and Link fields also carry `entryId`; GraphQL's `Link` has `entryId`.
- **A page that is gone** (deleted, in the bin, or unpublished): rich text keeps the words without a link, a Link field is delivered as `null`, and a builder button keeps its words without an address. Where the link is edited, the admin says "This page no longer exists. Choose another page, or type an address."
- **In the admin and the builder:** a link to a page shows the page's title in a read-only **Page** box instead of the address, with **Type an address instead** to go back to typing one.
- **Unchanged:** typed addresses and old `/about` links, which are not migrated.

**Tests:** `core/src/delivery/page-links.test.ts` (delivery API, built-in site, preview, an address that changes, a page in the bin, a page design), `core/src/fieldtypes/rich-text-pictures.test.ts`, a Liquid test in `liquid-pages.test.ts`, `builder-model/src/page-links/page-links.test.ts`, `builder/src/panels/page-picker.test.tsx`, `admin/src/page-links/PagePicker.test.tsx`.

**Screenshots** (`screenshots/links-pictures/`): before, the address stored by QOL-A-3: `qol-a/f3-after-link-field-*` and `qol-a/f3-after-richtext-link-form-*`. After, at desktop and 390px, light and dark: `link-field-page-*`, `richtext-link-page-*`, `richtext-link-gone-*`, `site-welcome-*`; the builder, desktop only (LINTEL-UX-013): `builder-button-page-*` and `builder-button-gone-*`.

## PICTURES-1: pictures inside rich text (3 November 2026)

**Asked for by Daniel:** people paste or drop a picture into their writing and expect it to appear. Rich text was words only.

**What changed:**

- **An `image` node** in rich text: a media library asset id, a description (alt text), an optional caption and where it sits (`full`, `left`, `right`). The node is defined once in core (`fieldtypes/rich-text-picture.ts`, exported as `@lintel/core/rich-text-picture`) and shared with the admin's editor.
- **Core checks it:** the asset must be in the media library, the description is at most 1,000 characters and the caption 500, and the position is one of the three.
- **Drawn on the site** as `<figure class="lintel-picture lintel-picture--right">` with the site's responsive `<img>` (`renderResponsiveImageHtml`) and a `<figcaption>`; left and right float beside the text from 40rem up. A picture whose image has been deleted is left out.
- **Delivery API:** in the JSON each picture carries its `image`, as image fields are delivered; Liquid's `rich_text` draws the same HTML.
- **The editor:** **Add picture** in the toolbar opens the image picker; a picture pasted or dropped into the text is uploaded and put where it landed (the upload helpers come from the paste-and-drop work on `feature/qol-photos-compare-schedule`, copied unchanged so the two merge cleanly). A new picture opens its settings straight away with **Describe the picture** focused and the library's description filled in; clicking a picture later opens them again, with Replace and Remove picture.

**Merging note:** `feature/qol-photos-compare-schedule` makes rich text refuse a dropped picture ("Pictures can’t go inside this text"). When both are merged, `RichTextFieldEditor.tsx` should keep this branch's behaviour, and `media.quickUpload.richTextNotHere` is then unused.

**Tests:** `core/src/fieldtypes/rich-text-pictures.test.ts` (rendering, validation, the JSON), `core/src/delivery/page-links.test.ts` (delivered shape and the built-in site), the Liquid test, `admin/src/fields/RichTextPictures.test.tsx` (Add picture, paste, settings, Remove).

**Checked in Chromium:** Add picture, a dropped file uploaded and inserted with its description focused, and the site at desktop and 390px.

**Screenshots** (`screenshots/links-pictures/`): before, the toolbar without pictures: `qol-a/f3-after-richtext-link-form-*`. After, at desktop and 390px, light and dark: `richtext-add-picture-*`, `richtext-dropped-*`, `richtext-picture-settings-*`, `site-welcome-*`.

## LINTEL-UX-035: adding motion without a wall of choices (3 November 2026)

**Reported by Daniel**, with a screenshot: after choosing a moment in the Motion panel (Appears, Hover, Click, Scroll, Always), the panel showed a long list ("26 choices") of tall cards, each with the same icon and a two-line paragraph. "This is very overwhelming." The moment tabs were also squeezed at panel width, so "Always" was cut off.

**Reproduced:** select a heading, open Animate, press Add motion and choose Hover. The panel lists every preset and effect for that moment in groups, each card with a paragraph; at the builder's side panel width the five moment tabs are truncated.

**Fix:** adding motion now starts with a good default and offers a few choices, with the full list one step away.

- **Choosing a moment puts motion on the element at once** and plays it on the page: Appears gives a fade up, Hover a gentle lift, Click a press, Scroll a slow parallax and Always a gentle pulse. Nothing is added until a moment is chosen.
- **Up to six small tiles** for the main alternatives of that moment. Each shows the movement itself as a tiny looping drawing (plain CSS, still for people who ask for less motion) with a one- or two-word name. The sentence that used to be on the card is now the tooltip and what screen readers hear. Choosing another tile, or another moment, swaps the motion rather than adding more. Only what suits the element is offered: "Word by word" for text, "Underline" for text and buttons.
- **A few plain controls** under the tiles: how much, speed, feel (smooth or springy) and, for entrances, when it starts. Only those that mean something show, so a scroll scene has just "How much" and a loop has no feel.
- **More settings** opens the existing full settings (Simple, and the timeline for designers). **More effects…** opens the full catalogue with its search, unchanged: every preset and effect is still there. A choice made there takes the place of the default. **Done** goes back to the list.
- **The moments fit the panel:** five buttons with the icon above the word, so no word is cut short. They and the tiles are radio groups; the arrow keys, Home and End move between them.
- Under Click, eye-catchers (Pulse, Bounce, Shake, Wiggle, Flash) play when the element is clicked, rather than waiting for a page event as they do from the catalogue. Something that starts with the page and never stops is now listed as "Always" rather than "When it appears".

What's saved is unchanged: the element's `animations` array (at most six) with ordinary preset specs and ids. Several animations per element, scroll scenes and their follows, range and snap settings all work as before.

**Tests:**

- `motion-editor/src/motion-panel/quickPicks.test.ts`: every tile is an existing preset or animation effect, there are at most six per moment, and the defaults are the gentle ones. It also checks that tiles suit the element, that Click tiles get a click trigger, and that the controls change the spec and keep it valid. Each control shows only when it applies.
- `motion-editor/src/motion-panel/MotionPanel.test.tsx`: nothing is added before a moment is chosen. Choosing one adds and plays its default, and tiles and moments swap rather than add. It also covers arrow keys, the controls, More settings, Done and the list's labels, and the catalogue with search, where a choice replaces the default and Back keeps it. An element that is full gets nothing added.
- `motion-editor/src/browser-tests/motionPanel.browser.test.ts` (Chromium): at side panel width no moment's word is clipped. The tiles' drawings play, and with reduced motion they are still and in view.
- `builder/src/animate-panel/effects-tab.test.tsx`, `builder/src/studio.test.tsx` and `builder/src/panels/panels.test.tsx` follow the new flow. Undo now steps back through each choice.

**Screenshots** (in `screenshots/motion-picker/`): `after-hover-desktop-light` and `after-hover-desktop-dark`, retaken on test data without the private reference pages (the "before" shots showed one of them and were removed). At 390px wide the designer shows its "needs a bigger screen" page, as before.

## Site motion: smooth scrolling, cursor, hover pictures, drag gallery, clock (3 November 2026)

**Asked for by Daniel:** let website makers build the kind of site that wins design awards (studio portfolios, product launches), with each piece one switch or one choice and nothing cluttered. Decision record: `docs/decisions/0034-site-motion.md`.

**What's new:**

- **Smooth scrolling** (builder, Animate tab with nothing selected, "Motion across the site"): Off, Gentle or Strong. The mouse wheel glides to a stop. It moves the page's real scroll position, so the scrollbar, sticky headers, scroll triggers and scroll scenes, find in page and links to part of a page keep working. Keys, the scrollbar, touch and jumps scroll as usual. Areas that scroll by themselves and pop-ups keep the browser's wheel. It's off for touch screens and for people who ask for less motion. Written in `@lintel/motion` (`src/smooth-scroll`, about 1.8 kB), loaded only when it's on.
- **Cursor:** the colour now follows the theme by default (Text colour or Brand colour, so it suits light and dark), with "Pick a colour" for anything else. It still grows over links and buttons. Over an element given a word, it turns into a small pill with that word. Less motion means no lag and no easing. Fields keep the normal cursor, and focus rings are untouched.
- **When the pointer is over it** (Animate tab, any element): **Word on the cursor** (No word, View, Open, Drag, Play, Read or your own) and **Show a picture when hovered** with a picture picker. The picture follows the pointer like a studio's project list. It's decorative (hidden from screen readers, clicks pass through it) and only for a mouse or trackpad. Both are saved as effects that the gallery leaves out, so pages only load their code when they use them.
- **Drag gallery:** the Slider has a new switch, "Let visitors drag it freely". It drops snapping, follows a mouse drag, glides on with momentum and gives a little at either end. Touch, the wheel, the arrow keys and Previous and Next still work, and a drag never counts as a click on a link inside it. Insert finds it under "drag gallery".
- **Clock:** a new element (Insert, search "clock" or "time zone") showing the time in a chosen city, or the visitor's own, as 24 or 12-hour. It changes on the minute and isn't read out as it ticks.

**Also fixed:** saving one part of the site's motion settings through the API (say, only `smoothScroll`) used to reset the parts left out to their defaults. Now only the parts sent change (`site-effects.routes.ts`).

**Tests:**

- `motion/src/browser-tests/site-motion.browser.test.ts` (12, in Chromium). Smooth scrolling: glides the real position, sticky stays put, Strong glides for longer, keys and links to part of the page take over, an inner scrolling area keeps the wheel, and it's off (and not loaded) for less motion, for touch and when the site has it off. Cursor: theme colour, growing over links, the word replacing the ring, the word on its own without a site cursor, and no easing for less motion. Hover picture: it shows and follows, is hidden from screen readers and doesn't block clicks.
- `motion/src/smooth-scroll/smoothScroll.test.ts` and `effects-catalogue/catalogue.test.ts`: wheel units, areas left alone, older saved settings, the cursor's colour, the unlisted effects and page weight.
- `builder/src/browser-tests/drag-gallery-and-clock.test.ts` (6, in Chromium): momentum, the soft stop and spring back, arrow keys without snapping, drags not clicking links, stopping exactly for less motion, and the clock showing Tokyo's time.
- `builder/src/render/elements/clock.test.tsx` and `builder/src/animate-panel/pointer-fields.test.tsx`; `motion-editor/src/effects/SiteMotionSettings.test.tsx`; `core/src/site-effects/site-effects.test.ts` (saving smooth scrolling on its own keeps the cursor, and pages load the module).

**Screenshots** (in `screenshots/site-motion/`): `site-hover-picture-desktop-light` and `-dark` (picture and "View" over a project row), `site-drag-gallery-desktop-light` and `-dark` (mid-drag, "Drag" on the cursor), `site-phone-light`, `site-phone-dark`, `site-phone-gallery-light` and `site-phone-gallery-dark` (390px: no cursor, picture or smooth scrolling). In the builder: `builder-site-motion-desktop-light` and `-dark`, `builder-pointer-fields-desktop-light` and `-dark`, `builder-clock-desktop-light` and `-dark`, and `builder-slider-drag-desktop-light` and `-dark`. The pictures in the shots were made for the test (plain colours with a name).

## Page transitions and first-visit intro (3 November 2026)

**Asked for by Daniel:** page-to-page flow like award-winning sites, easy to use and not cluttered: a page transition chosen once for the site, and an optional intro before the home page.

**Found:** a first version already existed, but it sat in the page builder's Animate tab, the intro showed on whichever page someone landed on, it still showed to people who ask for less motion, and the gallery also offered four whole-page presets ("Page fades in" and so on) that overlapped with it. A list where every picture had the "Morph between pages" name made the browser skip the transition entirely, because names must be unique.

**Built** (decision 0036):

- **Settings → Your website → Moving between pages**: two selects and a live preview. "When people open another page" is change straight away, Fade, Rise, Sweep up or Settle, and once one is chosen, a Quick, Steady or Slow speed. "Intro on the first visit" is no intro, a counting number, the site's name, the logo or a simple line, with its words and colours behind "Intro words and colours". Saved with the rest of the form.
- The preview plays the same keyframes the website uses, on a stand-in page, whenever a choice changes (not on opening, and not for people who ask for less motion). "Play again" replays it.
- **On the website**, transitions are cross-document view transitions (CSS only, no router). Fade keeps the browser's cross-fade; the others lay the new page over the old one. The intro is drawn on the home page only, at most once per visit, for 1.3 to 3 seconds. Any key, a click or "Skip intro" ends it. Its middle is hidden from screen readers and the page is complete underneath.
- **Less motion**: no transition and no intro, in CSS and in the runtime fallback.
- **Carry across pages** (renamed from "Morph between pages"): a small head script, sent only with transitions on, keeps each name unique, so in a list only the picture beside the followed link is carried.
- The four whole-page presets left the animation gallery. Saved designs that use them still play. The gallery's "Transitions" group is now "Section reveals", with a new "Split open". The builder's Animate tab keeps the cursor and points to Settings for the rest.

**Tests:**

- `motion/src/effects-catalogue/site-effects.test.ts`: off by default; old saved settings still read; the view transition CSS (reduced-motion guard, blending, timing for carried elements, keyframes as CSS); speeds; intro words, logo and fallback, screen-reader markup, scripts-and-motion guard.
- `motion/src/browser-tests/effects.browser.test.ts`: in Chromium, the intro never shows under reduced motion; any key ends it while counting; a real navigation has a view transition from CSS alone; none under reduced motion; only the picture beside the followed link keeps its carry name.
- `motion/src/presets/presets.test.ts`: the whole-page presets are out of the gallery but still found.
- `core/src/site-effects/site-effects.test.ts`: home page detection, the intro only on the home page with the site's name or logo, nothing when all is off, and through the real site server.
- `admin/src/website/PageFlowSettings.test.tsx`: calm when off, saving a look, speed and intro, nearest speed for an old length, the no-logo note, and leaving the section out when the settings can't be read.
- `builder/src/animate-panel/effects-tab.test.tsx`: the Animate tab offers the cursor and points to Settings.

**Screenshots** (in `screenshots/page-transitions/`): settings at desktop (`settings-off-desktop-light`, `settings-on-desktop-light-preview-transition`, `settings-on-desktop-light-more`; the section was also checked at 390px and in dark mode). On the website at desktop and 390px: `site-intro-*` (the counter, then lifting away), `site-transition-*` (frames mid-transition, slowed down; light and dark), `site-home-desktop-light`, `site-arrived-desktop-light` and `site-home-reduced-motion-no-intro`. Also `builder-animate-tab-cursor-only`.

## Designer: editorial grid, shared styles, variables (3 November 2026)

**Asked for by Daniel** (designer part 2, from the approved mock-up): the layout freedom of editorial sites (offset, overlapping, magazine-like grids, different on phones) while staying easy to use and uncluttered. The reasoning is in `docs/decisions/0035-editorial-layouts.md`.

**Before:** a section could only lay things out in order, or in a free layout placed by percentages. The Grid layout auto-flowed its items, and placing one meant typing `grid-column` in Advanced. A look had to be copied element by element, and the only named colours were the theme's eight.

**Built:**

- **Editorial grid.** Arrange now asks "Place things: In order / On a grid / Anywhere".
  - On a grid there are 4, 6, 8 or 12 columns. Drag an element onto them: the columns show while dragging, the target cells are shaded and labelled ("5–7").
  - The corner handle resizes an element. The arrow keys move it a column or a row, and Shift with an arrow resizes it.
  - Elements can overlap and be stacked.
  - Places are per screen size. On phones elements stack unless given a phone place: "Place it on phones too", and "Back to one under another" to undo that.
  - The panel shows "Columns [9] to [11]" and "Rows [5] to [5]", with the exact values folded away.
- **Shared styles.** At the top of Style there's a "Shared style" list: None, the site's shared styles, and "Make one from this look…". With one in use, it shows its name, "N on this page", "Changes apply to: Every "Card" / Only this one", Rename and Detach. Where an element sits always stays its own.
- **Design variables.** With nothing selected, Style shows "This site's styles": colours, sizes, fonts and shared styles, each with a name, a value and Delete.
  - Swatches, font choices and spacing chips offer the site's own after the theme's.
  - "Save as a site colour" appears under a colour picked by hand.
  - Values are checked by kind.

**Tests:**

- `builder-model`: `placed-grid/placed-grid.test.ts` (compiled CSS, phone stacking, reading places, validation) and `site-design/site-design.test.ts` (making, applying, overriding and detaching shared styles, the variables stylesheet, unsafe values, ids).
- `builder`:
  - `placed-grid/grid-fit.test.ts` (snapping maths);
  - `editor/placed-grid-commands.test.ts` (on, off, clamping, free layout or grid);
  - `canvas/canvas-messages.test.ts` (the `gridPlace` message);
  - `style-panel/advanced-styling.test.tsx` (the Arrange choices and the column and row lists, per screen size);
  - `site-design/site-design.test.tsx` (making, using, editing every or only this one, places staying own, detaching, adding and saving colours, refusing bad values);
  - `browser-tests/canvas-placed-grid.test.ts` (real Chromium: drawing, dragging with guides, the corner handle, arrow keys).
- `core`: `site-design/site-design.test.ts` (empty start, variables in the site stylesheet, a page drawn with a shared style, unsafe values refused, permission).

**Fixed while checking in the browser:**

- The column and row lists overflowed the panel, because the full-width input style was on short lists.
- The site styles rows squeezed the name to nothing. The value now has its own line.
- With a shared style in use, Arrange showed "1 to 12" because it read the shared look rather than the element's own place. Place changes now always go to the element.

**Known limits:**

- Changes to the site's design (variables, the shared look itself) aren't in the page's Undo.
- Variables don't change with a dark colour scheme.
- Canvas zoom, pan and the right-click menu come separately.

**Screenshots** (in `screenshots/designer-layout/`): `site-desktop`, `site-phone-390`, `builder-grid-place-light`, `builder-grid-place-dark`, `builder-grid-dragging-light`, `builder-shared-style-light`, `builder-site-styles-light` and `builder-site-styles-dark`. At 390px wide the designer shows its "needs a bigger screen" page, as before.

### Designer: canvas zoom and pan (3 November 2026)

**Built:** a small pill in the canvas's corner: zoom out, the zoom as a percentage (press it for actual size), zoom in and Fit.

- Ctrl (or ⌘) with the wheel, or a trackpad pinch, zooms, including over the page itself.
- Ctrl +, Ctrl − and Ctrl 0 step in, out and back to actual size, and Shift 1 fits. They work whether the page or the builder has focus, but not while typing in a field.
- When zoomed in past the space, holding Space and dragging moves around the page.
- The page keeps its own width, so zooming never changes its layout. Dropping from Insert still lands where the pointer is.

**Tests:** `builder/src/canvas/canvas-zoom.test.ts` (steps, wheel, keys, fit), `Canvas.test.tsx` (the buttons, the keys, Ctrl and the wheel, keys in fields left alone) and `canvas-messages.test.ts` (`zoomWheel`). Checked in Chromium in the admin: Ctrl and the wheel over the page zoom out to 55%, the buttons zoom in to 200%, and Space-drag scrolls the canvas.

**Screenshots:** `builder-zoomed-out-light` and `builder-zoomed-out-dark` in `screenshots/designer-layout/`.

## Site fonts: your own, Google Fonts and Adobe Fonts (3 November 2026)

**Asked for by Daniel:** "We should also be able to add our own fonts, connect adobe, and google fonts."

**Before:** a page could add one of the 23 included fonts, or upload a font file for that page alone, one weight at a time, with the name typed by hand. Nothing was shared between pages, the theme could only use its five system-font pairings, and there was no way to use Google Fonts beyond the included ones, or Adobe Fonts at all.

**Now:** each site has one list of fonts, in Settings → Your website → Manage fonts (`/settings/site/fonts`), and from "Add a font" in the builder's font list. "Add a font" has three tabs:

- **Google Fonts:** the whole library (about 2,000 families), searchable by name and kind, each shown in its own font, with popular ones first. Choose weights (Regular and Bold to start) and italics. Lintel downloads the files on the server and the website serves them itself, so visitors never contact Google (one line says so). Families that come with Lintel are marked.
- **Your files:** drop several files at once. Lintel reads each file's family, weight and style from inside it, or guesses from the file name ("Guessed from the file name"), and everything can be changed. One tick: "My licence lets me use this font on a website."
- **Adobe Fonts:** paste a web project ID. Lintel lists its fonts and links Adobe's stylesheet on every page; one line says Adobe serves them and the site's address must be added to the project. Wrong, unknown and empty projects are explained plainly.

The theme can use any site font or included font for **Headings** and **Body text**, in place of the pairing's. The builder's font list is grouped: Theme, Site fonts, This page only, Included fonts. A font a page uploaded for itself still works, and offers "Use it on every page". When the server is offline, the Google and Adobe tabs say so, and the included fonts still work.

Decision record: `docs/decisions/0037-site-fonts.md`. New table `site_fonts` (migration `0028_site_fonts`, checked on a fresh database in tests and on an older data folder at start-up).

**Tests:** core `site-fonts/site-fonts.test.ts` (16: uploads and the licence, reading names, Google search, download, preview, offline, removal, Adobe connect and errors, theme fonts, canvas, per-site, permissions; services mocked) and `font-file-names.test.ts` (7: WOFF2, TTF, WOFF, unreadable files, host allow-list, size cap, timeout). builder-model `fonts/site-fonts.test.ts` (`@font-face` output, unsafe values left out, Adobe IDs, file-name guesses). builder `style-panel/font-picker.test.tsx` (groups, Add a font, moving a page font, Adobe link on the canvas). admin `site-fonts/SiteFontsPage.test.tsx` (7) and `website/SiteSettingsPage.test.tsx` (heading font), and the Content-Security-Policy test.

**Checked in a browser:** added Playfair Display from Google Fonts and two uploaded files as "Hand Note", set them as heading and body fonts, and opened the published site at desktop and 390px: the browser loaded Playfair Display 700 and Hand Note 400 and 700 from the site's own server.

**Screenshots** (in `screenshots/fonts/`): `fonts-empty-desktop-light`, `google-popular-desktop-light`, `google-search-desktop-light`, `google-chosen-desktop-light`, `upload-desktop-light`, `adobe-desktop-light`, `theme-fonts-desktop-light`, `fonts-list-{desktop,phone}-{light,dark}`, `add-dialog-phone-{light,dark}`, `site-desktop` and `site-phone`.

## LINTEL-UX-037: the cursor circle jumps away on a click (3 November 2026)

**Reported by Daniel:** with the site cursor on, clicking sent the circle "miles away" from where he clicked.

**Reproduced:** with the pointer at (695, 457) and the mouse held down, the ring's centre moved to (591, 388), which is 0.85 × the position.

**Cause:** a press shrinks the ring with the `scale` property, and its position was a `transform`. Browsers apply `scale` before `transform`, so the shrink also shrank the distance from the window's corner. The word label had the same problem as it popped in.

**Fix:** the cursor's parts are now placed with the `translate` property (`calc(x - 50%) calc(y - 50%)`), which browsers apply after `scale`, so they shrink in place (`cursor.module.ts`).

**Test:** `motion/src/browser-tests/site-motion.browser.test.ts`, "stays on the pointer while pressed, wherever the pointer is". It fails without the fix (595, 425 instead of 700, 500) and passes with it.

## LINTEL-UX-039: following what's around an element, only when asked (3 November 2026)

**Reported by Daniel:** "this seems weird, whats the point of it", about "What has to be hovered" listing "This element", "Container, just around it", "Container, 2 levels up" and "Hero, around it".

**What it's for:** making an element change when something around it is hovered, pressed, opened or current, such as a picture that grows when its card is hovered. The problems were that it was always on show, though nearly everyone means the element itself, and that it named layout boxes people never think about.

**Fix:**

- Choosing Hovered (or Pressed, Open, Current) now just changes the element itself. Underneath, a quiet link, "Change it when something around it is hovered…", opens the list. It stays open while the element follows something around it.
- The list only offers what people recognise: cards, links, buttons, slides, tabs, accordion items, pop-ups and the like, plus anything with a name of its own ("Hero", "Two halves"). Plain containers and boxes are left out. It shows at most three, nearest first.
- Pointing at a name, or moving to it with the keyboard, outlines that element on the page.

**Tests:** `builder/src/panels/panels.test.tsx` (the list waits behind the link, and has no plain containers) and `builder/src/site-design/site-styles.test.tsx` (two cards with the same name are told apart, and the container between them isn't offered).

**Screenshots** (in `screenshots/looks/`): `follow-hidden-desktop-light`, `follow-list-desktop-light` (pointing at "Two halves" outlines it) and `follow-list-desktop-dark`.

## Starter site: Folio (3 November 2026)

**What:** a new starter site, Folio, a spare personal site for a fictional photographer and art director, Ilse Moreau, in Lisbon. It is in the template library after the others (Design → "Use this template").

- **Pages:** Home, Projects, About and Contact. Each starts with the same Header section (her name linking home, a live Clock showing Lisbon time in the monospace, and the menu) and ends with the same Footer section (email, social links, small print), one section each, so they can be switched to the new header and footer sections later.
- **Home:** a large statement on the twelve-column grid, stepped labels and a short line about her, then a drag gallery of six works (Slider with "Let visitors drag it freely", no dots, the cursor says "Drag"), then a short statement with links to About and Contact.
- **Projects:** eight rows (number, title, client, year); pointing at a row shows a frame from the project beside the pointer (hover picture).
- **About:** an original portrait drawing, a two-paragraph biography, clients and awards on the grid.
- **Contact:** the email address very large (the cursor says "Write"), how to write, and social links.
- **Look:** off-white paper and near-black ink, swapped in dark mode (`light-dark()` colours, so they follow the visitor's setting), Archivo for headings and text with Space Mono for the small details, square corners. The theme now takes an optional heading and body font from the included fonts.
- **Motion:** smooth scrolling Gentle, a small dot cursor in the text colour, the Fade page transition and the counter intro; word reveals on titles, a mask reveal on the portrait and email, quick fades elsewhere.
- **Pictures:** nine original SVG studies in warm greys (`illustrations-folio.ts`, each under 5 KB), and a contact-sheet cover for the library card. Every picture's alt text says what it shows.

**Judgement calls:** the header links are written into the page ("Projects", "About", "Contact") rather than following the site menu, so the header stays one simple row. The Contact section is at least as tall as the window so the footer sits at the bottom. Applying another template afterwards keeps Folio's heading and body fonts, because those templates don't name fonts.

**Tests:** builder-model `starter-sites/starter-sites.test.ts`, "gives Folio a drag gallery, a live clock, hover pictures and its own motion" (plus the existing checks every page now runs on Folio: valid design, one main heading, animations, illustrations that exist). core `starter-sites/starter-sites.test.ts`, "makes Folio with its fonts, its motion and a home page that says who it is for" (applies it, checks the fonts, the motion settings, the home page's words, clock, drag gallery and pictures, and that the site's own header is left out).

**Checked in a browser:** applied with `existingPages: "replace"` and `publish: true` to a copy of the test data, then looked at every page at 1440px and 390px in light and dark with reduced motion (no sideways scrolling at 390px), and with full motion on desktop: the intro counter, the smooth scroll, the "Drag" word over the gallery and a drag, the Fade transition to Projects and the hover picture on a project row.

**Screenshots** (in `screenshots/starter-folio/`): `{home,projects,about,contact}-{desktop,phone}-{light,dark}`, `intro-desktop-{light,dark}`, `home-midscroll-desktop-{light,dark}`, `home-drag-desktop-{light,dark}`, `transition-desktop-{light,dark}`, `projects-hover-desktop-{light,dark}` and `library-desktop-{light,dark}`.

## LINTEL-UX-040: a size no chip matches (3 November 2026)

**Reported by Daniel:** the Text group's summary said "1.125rem", but none of Normal, Small, Large, Huge or Giant was pressed.

**Reproduced:** an element whose text size was set elsewhere (in Advanced, or by a template) to a value no chip has showed its raw CSS value in the summary and no chip pressed.

**Fix:**

- Chips now show a pressed **"Custom · 18px"** after the choices when the value set matches none of them. Picking a chip replaces it. With nothing set, the chip nearest how it looks is still pressed. This works for every chip group, not just text size.
- Summaries give rem and em sizes in pixels ("18px"), which people know. Sizes that grow with the screen still read as written.

**Tests:** `builder/src/style-panel/advanced-styling.test.tsx` ("shows a size no chip matches as Custom, in pixels") and `style-summaries.test.ts` ("gives lengths in pixels").

## Starter site: Atelier (3 November 2026)

**Asked for by Daniel:** new starter sites that reach the level of sites featured for their design, using the editorial grid, site motion, the pointer touches and the included fonts.

**Now:** "Atelier" is in the template library: an editorial site for Wrenfold, a fictional four-person furniture workshop in Frome. Original words and original line drawings (warm paper, dark ink and one walnut tone, 14 SVGs of 1 to 3 kB each in `illustrations-atelier.ts`).

- **Home:** the headline "Made slowly, kept for good" arrives letter by letter; a full-width drawing of the workshop is uncovered and drifts with the scroll; a statement in large serif; the collection on the twelve-column grid with deliberate offsets, the title running over the first picture, small-capital captions and a "View" word on the cursor; a held scene, "How a Hollin chair is made", where the page stops while three steps slide past; a visit invitation with a magnetic button.
- **Collection:** six pieces on the grid, one cut out over its neighbour; "Up close", a Slider visitors drag freely (with "Drag" on the cursor); an index where each row shows the piece's drawing beside the pointer.
- **Craft:** a long read in a narrow column with chapter labels, two large italic pull quotes and drawings that move at different speeds.
- **Visit:** address, hours with a live Clock, getting here, a drawn map and a booking band.
- **Theme:** ochre walnut `#86602f`, square corners, Instrument Serif for headings and Work Sans for text. Warm bands are mixed from the brand colour and the page background, so they follow light and dark.
- **Site motion:** smooth scrolling Strong, the slide page transition, the "name" intro (Wrenfold) and a ring-and-dot cursor in the text colour.

**Change outside the site file:** a template without `headingFont` and `bodyFont` now goes back to its pairing's fonts when applied, instead of keeping the last template's.

**Tests:** builder-model `starter-sites/atelier.test.ts` (7: offered with its fonts and motion, every page accepted, the letter-by-letter headline, grid places and the overlap, the held scene, cursor words, hover pictures, the drag Slider and the Clock, alt text and drawing sizes). The shared starter-site tests cover it as well. Core `starter-sites.test.ts`, "applies Atelier with its fonts and motion": the theme fonts, the site motion, the published home and collection pages and a drawing, and fonts going back to the pairing when the bakery is applied afterwards.

**Checked in a browser:** applied with `POST /starter-sites/atelier/apply` (`existingPages: replace`, `publish: true`) to a copy of the test data, then opened the published site in Chromium at 1440px and 390px, light and dark, with reduced motion, mid-scroll in the held scene, with the cursor over a piece and over an index row, and on a first visit (intro).

**Judgement calls and limits:**

- The held scene uses the "Sideways scrolling section" preset (pinned, three panels). With reduced motion, or without scripts, it isn't held: the three steps sit side by side in a box that scrolls sideways, so step 1 shows and steps 2 and 3 need a sideways scroll. Showing them one under another would need the motion runtime to mark reduced motion on the page; worth a small follow-up.
- On a first visit the headline's letter reveal plays under the intro, so it has finished when the intro lifts. Letting page animations wait for the intro would be a runtime change, also left as a follow-up.
- The header and footer of the website template stay as they are (they show the site's own name); each page ends with one "Footer" section, ready for the header and footer sections work.

**Screenshots** (in `screenshots/starter-atelier/`): `{home,collection,craft,visit}-{desktop,phone}-{light,dark}`, `home-scene-mid-scroll-desktop-light`, `home-scene-mid-scroll-phone-dark`, `home-reduced-motion-desktop-light`, `home-cursor-word-desktop-light`, `collection-hover-picture-desktop-light` and `home-intro-desktop`.

## Starter site: Studio (3 November 2026)

**What:** a new starter site, "Studio", for architects, interior designers and design studios. The fictional practice is Corran Wade, eleven people in a former tile workshop in Lisbon. It has four pages:

- **Home:** the studio's name in very large type on the twelve-column grid, beside a drawing. Below it, an index of six projects as large rows: hovering over a row shows the project's drawing under the pointer, the word "View" on the cursor, and the row in the accent colour. Then a short statement, and a recognition list in Space Mono.
- **Work:** a large "Work" title, then the project index with Place, Discipline and Year columns, and a drag gallery of drawings (Slider with "Let visitors drag it freely", "Drag" on the cursor).
- **Studio:** the story of the workshop, "How we work" as four steps set alternately one column in, and a list of the people.
- **Contact:** a large email address, the address, a telephone number, opening hours, the Lisbon Clock, and how to find the door.

**Look:** ink and paper with one warm red (`#c8441f`, the brand colour). Archivo for headings and Inter for body text are set as the theme's fonts; Space Mono is used for captions. Corners are square. The site motion is Gentle smooth scrolling, the Ring cursor in the text colour (28px), the Fade page transition and no intro. Every band is a section placed on twelve columns (`placedGrid`), so people can drag things across the columns. On phones everything stacks, the middle index columns fold away, and each project row shows its drawing, since there is no pointer to follow.

**Pictures:** nine original line drawings in `illustrations-studio.ts`: elevations, plans and sections, a saw-tooth workshop and a site plan, plus the library cover `studio-cover`. Each is 0.8 to 2.7 KB, and every picture has alt text that says what it shows.

**Changes outside the site file:**

- `StarterTheme` gains optional `headingFont` and `bodyFont`, which go through the website's theme settings as they are.
- `illustrations.ts` has one import and one spread.
- `starter-sites.ts` has one import and one entry.

**Judgement calls:**

- On the Work page the project names are level-2 headings, because the index follows the page title. The new heading-order test caught level 3 there.
- The home page's opening drawing is hidden on phones, because the first project row shows the same drawing just below it.
- The Work page's rows are not links, because there are no project pages yet. The home page's rows link to Work.

**Tests:**

- builder-model `starter-sites/studio.test.ts` (5): pages, fonts and motion; every band on the grid; the hover picture and "View" on each home row, with drawings that exist; the drag gallery and the Lisbon clock; alt text and heading order.
- core `starter-sites.test.ts`: "applies Studio": its fonts, its motion, and a home page with the studio's name, the index and its drawing, plus the drawing served from `/_lintel/illustrations/`.
- Results: builder-model 237 passed; core `src/website` and `src/starter-sites` 60 passed.

**Checked in a browser:** applied with `POST /starter-sites/studio/apply` (`existingPages: "replace"`, `publish: true`) to a copy of the test data. For the screenshots, the test site's name was set to Corran Wade and its main menu to Work, Studio and Contact. Checked at 1440px and 390px, light and dark, with reduced motion, and while hovering over a project row.

**Screenshots** (in `screenshots/starter-studio/`):

- `{home,work,studio,contact}-{desktop,phone}-{light,dark}`
- `home-midscroll-desktop-{light,dark}`
- `home-hover-desktop-{light,dark}`
- `reduced-motion-{home,contact}-*`

## Starter site: Studio, its own identity (3 November 2026)

**Why:** Folio, merged at the same time, is also set in Lisbon, also uses Archivo with Space Mono, and also has a red accent. Side by side in the template library, the two looked the same.

**Changes to Studio:**

- **Place:** the practice is now in Rotterdam, in a former rope works in the Merwe-Vierhavens. The Clock uses Europe/Amsterdam.
- **Names:** project, place and people names are Dutch-flavoured: Huis aan de Dijk, Maasbad, Kade Reading Room, Polder Pavilion, Mieke Corran and others. No Lisbon references are left.
- **Fonts:** headings are Space Grotesk (700). Body text is still Inter, and captions are still Space Mono.
- **Accent:**
  - The accent is cobalt `#2447d6` in place of red: 7.1:1 on white and 5.8:1 on the drawings' paper.
  - The template adds a **Cobalt** design variable with a dark-mode value of `#7d95ff` (7.6:1 on black). The hovered row, the step numbers and link hovers use it, so they read on ink in dark mode. The theme's automatic dark link colour would have been `#506cde`, which is only 4.5:1.
  - The drawings use cobalt too, with a lighter `#5a78f0` on the two dark drawings.
- **New template option:** a starter site can now bring design variables (`designVariables` on `StarterSite`). They are applied with the theme, and one with the same id is replaced.

**Merge:** `release/1.0.0-rc` (with Folio) was merged in first. `StarterTheme` keeps one copy of `headingFont` and `bodyFont`. `illustrations.ts` and `starter-sites.ts` list both sites.

**Tests:**

- builder-model: 247 passed. `studio.test.ts` now also checks Space Grotesk, the Cobalt variable and its dark value, the hover colour, and the Amsterdam clock.
- core `src/starter-sites`, `src/website`, `src/site-design` and `src/site-effects`: 77 passed. The Studio test now also checks the variable saved to `/website/design`.

**Screenshots:** every file in `screenshots/starter-studio/` was retaken with the new identity.

## LINTEL-UX-036: reusing styles: the Styles tab, variables everywhere (3 November 2026)

**Asked for by Daniel:** "We need a way to easily reuse styles, like style variables as webflow does it." His screenshot of the Style panel showed section summaries saying `#111111` and `#ffffff` rather than a name, "Shared style: None" as a bare dropdown with no explanation, the site's variables only reachable by deselecting everything, and "Container, around it" twice in "What has to be hovered".

**Where it lives:** Daniel asked for style management in the right panel, where people look for how things look, so there is no Styles tab on the left. "Site styles" is a row in Style that opens the whole list over the element's Style, with Back (as "More effects…" does in Motion), and it's what Style shows with nothing selected.

**Now:**

- **Site styles** lists Colours, Sizes and Fonts (swatch, "Aa" or a bar; the value; how often it's used) and Shared styles (a small preview and how many are on this page), plus "Every element of a kind". Rows open one at a time to rename, change or delete. Empty groups offer starting points (Ink, Paper, Accent; Gutter, Section space, Reading width; Display, Text). Deleting asks first and says what happens: a used colour's value is written out on this page's elements (a step in Undo) and in the shared styles, so they look as they did.
- **Variables everywhere:** swatches, size chips, the font list and size boxes list the site's own first, then the theme's. A closed section says the variable's name with a small dot ("Text · Bold · Ink"). A size box using one shows its name with Unlink, and a size typed by hand can be saved ("Save as a size"), as colours already could.
- **Light and dark:** a colour can have a dark-mode value ("Add a dark-mode colour"). It's written with `light-dark()`, which follows the colour scheme the theme sets: the visitor's own with an automatic theme, always light or dark with a fixed one. Paper on a dark-mode visit is now dark, so the text on it can be read.
- **The shared-style row:** "No shared style · Save this look to reuse it" opens to "Save this look…" or the site's list. With one: "Button · Outline · 1 on this page", where changes go ("Every Outline" or "Only this one"), and Rename, Make a variant and Detach.
- **Variants:** a variant (Button → Outline) takes its base's look under its own, so changing Button changes Outline too. "Main · Outline" switches between them. Older designs have no variants and read as before. Deleting a base keeps its variants' look.
- **Select them:** in Site styles, selects the first element on the page using a shared style and outlines the rest on the canvas.
- **Every element of a kind:** All headings, All paragraphs, All links, All buttons and All pictures, each with the usual style controls (and Hovered for links and buttons). Headings, paragraphs and links are rules in the site's stylesheet no stronger than a tag (`:where(.lintel-design) p`), so any element style or shared style wins and they reach rich text too. Buttons and pictures start with styles of their own that a stylesheet rule can't get under, so their kind's look replaces those starting values when the page is drawn; anything changed on one button stays, and shared styles still win.
- **"What has to be hovered":** two elements with the same name now read "Container, just around it" and "Container, 2 levels up" (the list has since been narrowed to recognisable elements behind a link; see LINTEL-UX-039).

Decision record: `docs/decisions/0038-reusing-styles.md`. No migration: the site's design is still one settings row; `darkValue`, `variantOf` and `tagStyles` are optional, so pages drawn before are unchanged.

**Tests:** builder-model `site-design/site-design.test.ts` (variable uses and writing out, `light-dark()` output and checks, variants: drawing, following the base, deleting the base, older designs) and `site-design/tag-styles.test.ts` (rule output and specificity, markers, buttons over starting styles and under changes and shared styles, nothing changes without them, schema). builder `site-design/site-styles.test.tsx` (10: drill-in and Back, starting points and counts, variable names in summaries, site colours first, deleting a used colour, dark values, variants, Select them and deleting a shared style, All headings and All links while hovered, hover owners told apart), `site-design.test.tsx` (the new row), and `editor/design-commands.test.ts` (writing a variable out, detaching everything, switching variants). core `site-design/site-design.test.ts` (dark values and tag styles in the website's stylesheet; a button drawn with the site's look and its own change).

**Checked in a browser:** the builder at desktop in light and dark (Site styles, the shared-style row, summaries with variable names, All buttons and All links), and the published test page at desktop and 390px in light and dark with heading, link and button looks and a dark-mode colour.

**Screenshots** (in `screenshots/styles-panel/`): `builder-nothing-selected-{light,dark}`, `builder-style-{light,dark}`, `builder-site-styles-{light,dark}`, `builder-site-styles-colour-open-{light,dark}`, `builder-site-styles-all-{light,dark}`, `builder-summary-variable-{light,dark}`, `builder-shared-row-{light,dark}`, `builder-shared-choose-light`, `builder-shared-variant-name-light`, `builder-shared-variant-light`, `builder-site-styles-shared-light`, `builder-all-buttons-{light,dark}`, `builder-all-links-hover-{light,dark}`, and the published page `site-{desktop,phone}-{light,dark}` (All headings, links and buttons in the site's look, and Paper and Clay colours with their own dark-mode values). All were retaken on test data without the private reference pages; the earlier "before" shot of the fixed Paper colour was removed, since it showed one of them and the old behaviour can't be shown again.

## LINTEL-UX-038: navigation and footer as sections you add (3 November 2026)

**Reported by Daniel, with screenshots:** every published page gets the site's header ("Sam's Bakery · Home · Shop") and footer bolted on, even a page whose top row is its own logo and menu. The UX-023 fix only stepped aside for a page with a header section, not for a menu row in an ordinary section. Daniel decided: make Navigation (and Footer) sections people add, not something automatic.

**Reproduced:** a page whose first section holds a logo and a menu, published, showed the site's header above its own (`before-own-menu-site-{light,dark}`), and the builder showed the same two navigations (`before-own-menu-two-navigations-offer-*`).

**Now:**

- **Insert → Sections** has a **Navigation** group (Logo and menu, Centred logo, Menu and button, Over the first section, Logo and Menu button) and a **Footer** group (Simple, With columns, Centred, One-line, Big name). They're built from a new **Site logo** element and the Menu element following the site's main menu ("Which menu" chooses another). On phones the menu folds into a Menu button that opens a drawer (a `<dialog>`: focus moves into it, Escape closes it). Theme colours only, so they follow light and dark.
- **Added once, on every page.** A Navigation or Footer section is stored once per site (`GET`/`PUT /website/sections`, one settings row per site) and shown on every page in the same place; editing it on any page edits it everywhere. Pages don't keep a copy. On the canvas, selecting it shows a strip, "Navigation · on every page", with **Hide on this page**. Deleting it on a page hides it there.
- **The page's own switches:** the Content tab with nothing selected has "On this page: Show the site's navigation / footer".
- **Any section can become one:** "Navigation and footer" under a top-level section: Use as the site's navigation, Use as the site's footer, Use as this page's own navigation.
- **Daniel's case:** when a page's first section holds a menu or a row of links, the builder offers "This page starts with its own menu. Use it as this page's navigation?". Yes makes it the page's `<header>` and hides the site's navigation on that page, so it never gets two (`after-own-menu-*`).
- **On the website** the site's navigation and footer go where the automatic ones went, outside `<main>` after the skip link (one banner landmark), with the current page marked in the menu. Blog posts, lists and Liquid pages get them too; `{% site_header %}` and `{% site_footer %}` draw them.
- **Older sites, new sites:** a site without a navigation section keeps the automatic header (the same for the footer) until it adds one; then the automatic one is gone everywhere and the builder says so in one line. Setup, starter templates and sites added in Websites and domains start with Logo and menu and Centred footer. The Centred footer has a Language switcher, so a site in several languages keeps the language links the automatic footer had; the switcher now shows nothing on the website of a site in one language.

Decision record: `docs/decisions/0039-navigation-and-footer-sections.md`. No migration: the sections are a settings row per site.

**Tests:**

- builder-model `site-sections/site-sections.test.ts` (23): putting the sections into a page and taking them out, hidden per page, never doubling a page's own header, renaming references, class names kept apart, the own-navigation offer, and every Navigation and Footer layout valid with the site's menu.
- builder `site-sections/site-sections.test.tsx` (10): insert, replace and undo; delete hides; use as the site's footer; mark as the page's own; template pages keep the sections; Insert saves to the site and not the page; Hide on this page from the strip; the page's switches; the offer.
- site-components `document/site-sections.test.tsx` (3): in place of the automatic header and footer, outside `<main>`, with their styles and script; left off a page that hides them; merged once in the head.
- core `site-sections/site-sections.test.ts` (9): legacy sites unchanged; shared navigation on every page and not stored in pages; hidden per page and no double header; current page marked; taken off brings the automatic one back; permissions and checking; starter templates; new sites; starter sections never replace a site's own. `liquid-templates/liquid-pages.test.ts` (`{% site_header %}` and `{% site_footer %}`), `setup/site-setup.test.ts`, `starter-sites/starter-sites.test.ts` (a plain page's only script is now the elements script the Menu button needs), `website/website-sites.test.ts` (a new site under a path prefix: the logo and language links keep it).
- admin `page-design/PageDesignPage.test.tsx`: adding a Navigation saves it for the site, and the page's save leaves it out.

**Checked in a browser** (Chromium): the builder at desktop, light and dark (the Insert Navigation group, the "on every page" strip, the section tools, the switch-over note, the offer and Hide on this page); the published site at desktop and 390px, light and dark, with the Menu drawer opened from the keyboard on a phone (focus on Close, Escape closes it). Every layout checked at both sizes in both modes.

**Screenshots** (in `screenshots/navigation-sections/`): before: `before-builder-automatic-header-dark`, `before-own-menu-site-{light,dark}`, `before-own-menu-two-navigations-offer-{light,dark}`; builder: `builder-insert-navigation-{light,dark}`, `builder-navigation-on-every-page-{light,dark}`, `builder-section-tools-{light,dark}`, `after-builder-navigation-added-note-light`, `after-builder-footer-added-light`; after: `after-own-menu-builder-light`, `after-own-menu-hide-on-this-page-light`, `after-own-menu-site-desktop-{light,dark}`; website: `site-shared-navigation-{desktop,phone,phone-menu,desktop-footer}-{light,dark}`, `site-all-layouts-{desktop,phone}-{light,dark}`.

**Follow-up (after merging the Studio, Atelier and Folio starter sites):**

- A new site under a path prefix lost the automatic header's prefixed home link once it started with its own navigation (`website-sites.test.ts` expected `lintel-header__brand`). The Site logo already links to the prefixed home; links typed into the site's navigation and footer ("/work") are now drawn with the site's path prefix and language too. New test: "keeps the path prefix in the links of a site's own navigation and footer".
- Studio, Atelier and Folio no longer repeat a header and footer on each page. Each brings its own shared navigation and footer (`siteSections` on the starter site), in its own look: Folio's navigation keeps the Lisbon clock (its menu now follows the site's menu, its name the site's name), Studio's footer keeps the Rotterdam clock and the cobalt hover, Atelier's footer is the big "Wrenfold" one. Studio and Atelier, which had only a footer, gain a navigation in their type (Studio's mono captions, Atelier's serif name and small caps). Applying a template with its look replaces the site's sections with the template's. Tests: `studio.test.ts`, `atelier.test.ts`, `starter-sites.test.ts` (Folio) and core `site-sections.test.ts` ("uses a starter template's own navigation and footer").

## LINTEL-UX-042: the cursor over videos (3 November 2026)

**Reported:** with the site cursor on and the word "Play" on a video, the "Play" pill stayed frozen in the middle of a YouTube video while YouTube's own controls showed.

**Cause:** an embedded player is an iframe, and an iframe keeps the pointer's events to itself. Once the pointer crossed onto the video, the page stopped hearing where it was, so the site cursor, the word and any hover picture stayed where the pointer had crossed. The element's own "pointer left" never fired either, because the iframe is inside the element.

**Reproduced:** the new browser tests failed on the old code (the word and the hover picture never went away over the frame), and `042-cursor-over-video-before-{light,dark}` shows the frozen "Play" pill.

**Now:** when the pointer moves onto an embedded frame (iframe, embed or object), the site cursor, its word and any hover picture hide and the frame's own cursor shows. They come back as soon as the pointer is back on the page: the word reappears if the pointer is still on the video element, and the cursor appears where the pointer is instead of gliding over from where it left. A pointer that lands straight on a frame never shows the word at all. The click-to-load placeholder is ordinary page content, so the word works on it as before. A video file (`<video>`) is part of the page, so the word shows over it, and since the cursor parts ignore the pointer, clicks still reach the player's controls.

Files: `packages/motion/src/effects/kit/pointer.ts` (`isEmbeddedFrame`, `pointerOnFrame`, `watchEmbeddedFrames`), `effects/modules/cursor.module.ts` (site cursor and word), `effects/modules/pointer.module.ts` (hover picture).

**Tests:** motion `browser-tests/site-motion.browser.test.ts`, "over an embedded video" (5): the site cursor and word hide over the frame and come back after; the word on its own (no site cursor) hides and comes back; no word when the pointer lands straight on the frame; a hover picture hides over the frame; over a video file the word shows and clicks still reach the player.

**Screenshots** (`screenshots/motion-polish/`): `042-cursor-over-video-before-{light,dark}`, `042-cursor-over-video-after-{light,dark}`.

Commits: 974a55a, and 1abd938 for the effect modules' recorded sizes.

## LINTEL-UX-043: trigger settings squeezed in the timeline (3 November 2026)

**Reported:** in the Motion panel's Advanced view, the Trigger settings sat in a narrow column: "It scrolls i…", "How much must show" with "Any of it / All of it" overlapping "20%", and "Afterwards" and "Scrolling back up past it" crammed into tiny selects.

**Cause:** the timeline put the keyframe settings and the animation settings side by side whenever the window was wide (`lg:grid-cols-2`), even inside the builder's 300px side panel. The trigger's settings were then two to a row inside that half.

**Reproduced:** `043-trigger-settings-before-{light,dark}` (builder, Designer tools, desktop width); the new browser test failed on the old code.

**Now:** the timeline, the animation settings, the trigger settings and the keyframe settings lay out by the space they actually have (container queries), not by the window. In the side panel every setting has its own row and full-width select; the slider's end words have room and the value shows beside the label. Where there is room, as in the full-screen studio, they still sit side by side. The empty spacer left beside "How much must show" when "Afterwards" doesn't apply is gone.

Files: `packages/motion-editor/src/trigger/TriggerPicker.tsx`, `timeline/AnimationSettings.tsx`, `timeline/TimelineEditor.tsx`, `timeline/KeyframeInspector.tsx`, `controls/Slider.tsx`.

**Tests:** motion-editor `browser-tests/studio.browser.test.ts`, "the trigger's settings in a narrow panel" (2): in a 300px column in a wide window each control is as wide as the panel and below the one before, and "Any of it" and "All of it" don't overlap; in the full studio the settings are still side by side.

**Screenshots:** `043-trigger-settings-before-{light,dark}`, `043-trigger-settings-after-{light,dark}`.

Commit: aab747a.

## LINTEL-UX-044: growing from small while scrolling (3 November 2026)

**Asked:** "what if we wanted something to animate as the user is scrolling? E.g. a video growing from 0.1 to 1 in size."

**Reproduced:** Scroll → Grow on a video goes from 80% to full size, and "How much" at Dramatic only reaches 60% (`044-grow-while-scrolling-before-{light,dark}`).

**Now:** for a grow while scrolling, "How much" runs from Subtle (it starts at 90% of its size) to Dramatic (it starts at a tenth), and the size it starts at shows beside it ("Starts at 10%") and is read out by screen readers. Other motions keep "How much" as it was.

Judgement call: the brief asked for both a wider "How much" and a separate "Starts at" control. These would set the same thing, so they're one slider, with the starting size shown as its value. That keeps the panel uncluttered.

**Checked:** a video scales smoothly with the scroll on the browser's own scroll timeline, from 10% when its top meets the bottom of the window to full size when its middle reaches the middle, and stays centred as it grows. On the canvas the scene's Start and End lines show as for any scroll scene.

Files: `packages/motion-editor/src/motion-panel/quickPicks.ts` (`growsFrom`, `startSizeFor`, `distanceForStartSize`, `growRange`), `motion-panel/QuickMotion.tsx`, `strings/motionPanelStrings.ts`.

**Tests:** motion-editor `quickPicks.test.ts` (the mapping: only scroll grows count, round trips between "How much" and the size it starts at, never below 10% or above 90%, the saved spec goes 0.1 → 1); `MotionPanel.test.tsx` (on a video, Scroll → Grow shows "Starts at 80%"; Dramatic saves scale 0.1 → 1 and Subtle 0.9 → 1). Motion `browser-tests/runtime.browser.test.ts`: a video's scale goes 0.1 → 1 across its scene and it stays centred.

**Screenshots:** `044-grow-while-scrolling-before-{light,dark}`, `044-grow-while-scrolling-after-{light,dark}`.

Commit: 3ea18b0.

## LINTEL-UX-062: quieter moment colours in the Motion panel (3 November 2026)

**Found in the UI sweep, approved by Daniel:** the moment tiles (Appears, Hover, Click, Scroll, Always) used the iOS system blue, orange, purple, teal and green. That is the generic look removed elsewhere (UX-018, UX-020), and it clashed with the admin's warm neutrals.

**Fix:** the tiles now use quiet, earthy tones: slate, ochre, plum, sage and olive (`#4f6b78`, `#93652b`, `#76586f`, `#3f7466`, `#66733a`). A white icon on each passes 5:1 or better, in light and dark mode. The chosen moment's icon in the picker now uses the normal text colour instead of its tile colour, so it reads in both modes (`motion-editor/src/motion-panel/MomentPicker.tsx`).

## LINTEL-UX-063: Start and End lines you can see (3 November 2026)

**Asked by Daniel:** "if its on page scrolls, should they see the scrubs so they can set when it starts / ends?" They should, and the builder draws them for a selected element's scroll scene.

**Found:** in Daniel's case no lines showed at all, because the admin dev server was serving a canvas script from before the lines existed (it reads it once at start). Restarting it brought them back, and a built copy of Lintel was never affected. What remained was that a default scene runs from the bottom of the screen (Start, 100%) to the top (End, 0%), so the lines sat exactly on the canvas's edges, with End's label above the top.

**Fix:** the lines are drawn just inside the canvas (1.5% to 98.5%), and a line near the top shows its label below it (`canvas-frame-script.ts`). The scene's saved positions are unchanged.

## LINTEL-UX-041: a cookie notice by default when the site needs one (3 November 2026)

Daniel: "if videos, or google maps or anything, we will need to add a cookie acceptance by default." Before, each YouTube or Vimeo video, map and Embed element showed its own "Load …" placeholder, Adobe Fonts loaded from Adobe without asking, and there was no site-wide notice or way to change a choice.

**Reproduced:** a page with a YouTube video and a map showed two separate placeholders and nothing else; a site with Adobe Fonts linked `use.typekit.net` on every page before any choice.

**Fixed:**

- **On by default, only when needed.** Core (`src/cookie-notice`) reads what the published site uses: page designs in every collection with pages and every language, the site's navigation and footer, the site's blocks they use, Adobe Fonts, and services plugins declare (`consentServices` in `definePlugin`). Sites using none of these show nothing and load no notice code. The notice's script (`/_lintel/cookie-notice-<fingerprint>.js`, its CSS inside) is a separate bundle; no third-party script is involved.
- **The notice** names the services ("This site uses OpenStreetMap and YouTube, which may set cookies. Nothing from them loads until you say so."), with **Accept all** and **Only necessary** looking the same, and **Choose** (a switch per service). It is a non-modal region with a heading, placed after the skip link, never takes focus, keeps room at the end of the page, follows the theme's fonts, colours, corners and light/dark, slides in only without reduced motion, and stacks at 390px.
- **The choice** is kept in localStorage (no cookie) per site for about six months, and only while the services list is the same; a changed list asks again. Accepting loads the allowed embeds in place without a reload (videos don't start playing by themselves). Only necessary keeps each placeholder, which still loads just that one. Withdrawing a service that already loaded reloads the page.
- **Adobe Fonts** waits for consent; until then the heading and body fall back to the theme's pairing fonts. The font settings say so. The builder's canvas still shows them.
- **A way back:** "Cookie settings" in the automatic footer, the Site footer element, the section library's footers, the Studio, Atelier and Folio footers, a new **Cookie settings** element, and `{% cookie_settings %}` for Liquid. Each shows only on sites with the notice.
- **Settings → Your website → Cookie notice:** Automatic (recommended), Always, Off; bar or corner card; heading, message (`{services}` is filled in) and a privacy page from the page picker. Off shows a plain warning and says it is general guidance, not legal advice.
- **Plugins:** `window.lintelConsent.allows("plugin:<id>:<handle>")` and the `lintel:consent` event.

Decision record: `docs/decisions/0040-cookie-notice.md`. No migration: the settings are one settings row.

**Judgement calls:** Embeds set to "Load without asking" and Code elements are not counted (the maker's own call; Always covers them). The Map element uses OpenStreetMap, so the notice names OpenStreetMap rather than Google Maps. Settings are shared by every site of an install, like the rest of the website's look; choices are kept per site.

**Tests:**

- builder-model `consent/consent-services.test.ts` (2): services found in designs and the site's blocks, embeds named, stable version.
- builder `site-behaviours/cookie-notice.test.ts` (8): asks first without taking focus; Accept all loads embeds without a reload and is remembered; Only necessary keeps placeholders, each still loads; Choose and Cookie settings; a changed list or six months asks again; no notice, no change; autoplay. `render/elements/cookie-settings.test.tsx` (2). Browser test `browser-tests/cookie-notice.test.ts` (2): with the real bundles, nothing is requested from YouTube or OpenStreetMap before consent; keyboard order; Only necessary then Cookie settings.
- core `cookie-notice/cookie-notice.test.ts` (8): nothing on a site without services; on by itself with a YouTube video and a map, naming both, script served, footer link; Off, Always, position, words and privacy page; Adobe Fonts waits; footer section, blocks and plugin services; the message; the font fallback.

**Checked in a browser** (Chromium) on the published site with a YouTube video and a map: desktop and 390px in light, desktop in dark, Choose at 390px, after Accept all, and the settings at desktop.

**Screenshots** (in `screenshots/cookie-consent/`): `site-desktop-light`, `site-390-light`, `site-390-choose`, `site-desktop-dark`, `site-desktop-accepted`, `settings-desktop`, `settings-off-warning`.

## Drafting a page from a description

**Asked for:** draft a page from a plain description, with a model running on the site's own server and nothing sent anywhere at run time. An optional plugin, off by default (approved by Daniel).

**Now:**

- **Page drafting** in Build → Features (plugin id `drafts`, off by default). Switched on, it does nothing until an admin sets the model up.
- **Settings → Page drafting**, before anything is downloaded, shows the model (Qwen2.5 7B Instruct), who made it (the Qwen team at Alibaba Cloud), its licence (Apache License 2.0, linked), its size (4.4 GB), the exact addresses it downloads from (the makers' own repository, pinned to one revision), the folder it is saved in, the memory it needs (about 6 GB free), and "Nothing about your site is sent anywhere, now or later. After this it works offline." Then **Download 4.4 GB** (progress, Cancel keeps what arrived, Resume carries on with a Range request) or **I'll copy the file in myself** (the folder and file names, then Check files). Every file is checked against its published SHA-256 and deleted and refused if it doesn't match. Installed, the screen shows the same details and **Remove**. A server with too little memory or disk is told so plainly, and Download is refused when the disk is too small.
- **In the builder:** "Draft a page for me" on an empty page and at the top of Insert → Sections. A short form: what the page is for, who it's for, a tone, and which sections (Welcome, What you offer, About you and Call to action to start with; all off lets the model choose). It says "This can take a minute or two" and asks people to read the words before publishing. While it writes: a progress bar and **Stop**. The model writes under a grammar made from the plan's JSON schema, so the answer is always Lintel's own section kinds in the chosen order; the plan is checked again and built with the section library's own builders, so the sections are ordinary, editable and in the site's theme. They are added as one change (one Undo), never published. Buttons link to `#` until a page is chosen, pictures are the library's illustrations, example quotes are signed "Customer name", and the model is told to write placeholders such as `[price]` instead of inventing facts.
- **Rewrite this:** Shorter, Friendlier and More formal under a heading's or paragraph's words in the Content tab, once the model is installed. Undo puts the old words back.
- **Limits:** one draft at a time per server, a five-minute limit, a free-memory check before the model loads (it is freed after five idle minutes), permission `drafts:use` (Editor and Admin; not Author or Viewer). Prompts and answers stay in memory for the person who asked, for ten minutes; nothing is logged or stored.

Decision record: `docs/decisions/0043-page-drafting.md` (the model's exact files, sizes and checksums, and what downloads when). No migration: the plugin has no tables.

**Tests (the model is always stood in; nothing large is downloaded):**

- builder-model `page-drafts/draft-plan.test.ts` (13): every kind of section, refusing unknown kinds, missing, empty and over-long words; the JSON schema holding the model to the chosen sections in order, or three to six of any; only grammar-safe keywords; every kind making a valid page; links to `#`, unattributed quotes, illustrations taking turns.
- core `page-drafts/page-drafts.test.ts` (18): plugin off answers 404 and never touches the model or the disk; the setup details before any download; download and check; a bad checksum refused and deleted; resuming after a broken download (`bytes=100000-`); cancelling keeps what arrived; files copied in by hand found and checked; removing; too little memory; drafting with exactly the chosen sections; refusing before install; a malformed answer; one draft at a time and Stop; the time limit; the free-memory guard; rewriting; `drafts:use` for editors and admins and not authors; a draft visible only to the person who asked. `plugins.test.ts` and `plugin-system.test.ts` list the new plugin.
- builder `page-drafts/page-drafts.test.tsx` (7): not offered without page drafting; the form, inserting as one change and Undo; Stop adds nothing; a failure keeps the form; the not-set-up note; Rewrite this.
- admin `page-drafts/PageDraftingSettingsPage.test.tsx` (5): the details before download; copying in by hand; progress with Cancel; too small a server; Remove after asking.

**Checked in a browser** (Chromium, desktop, light and dark): the setup screen before download (real API), the draft form, and a drafted page (the server's drafting answers stood in with Playwright, since no model was downloaded on this machine). A real end-to-end run with the 4.4 GB model was skipped; node-llama-cpp's prebuilt llama.cpp was checked to load on this machine with `build: "never"`.

**Screenshots** (in `screenshots/page-drafts/`): `setup-before-download-{light,dark}`, `draft-form-{light,dark}`, `draft-writing-light`, `drafted-page-{light,dark}`.

**Screenshots retaken (3 November 2026):** the test data had private reference pages, which showed in menus and on the canvas. All the `screenshots/navigation-sections/` shots above were retaken with the same names on data without them (menu: Home, Our story, Shop). While doing so, the "All links" look was found underlining the Site logo; links now leave it alone, as they do menus (`site-design/tag-styles.ts`, test updated).

## A/B testing: trying another version of a page (3 November 2026)

**Asked for by Daniel:** a way for site owners to try another version of a page and see which works better, as its own plugin, privacy-first, with no third parties.

**Now (the A/B testing plugin, `experiments`, off until switched on in Build → Features):**

- **In the designer**, the toolbar has **Try another version**: of the whole page, or of the section around what's selected. Version B opens on the canvas as an ordinary editable page; the toolbar then switches between **Original** and **B** (and **C**, up to three versions), adds a version as a copy of the original or of B, and links to the test's settings. B and C save to the test as the page saves. A section version is drawn in the page as it is now, the other sections locked, so only that section changes. The site's shared navigation and footer can't be tried on their own.
- **A/B tests** in the sidebar lists every test with its state and goal. A test's screen has **What counts as success** (someone sends a form, places an order with the shop on, clicks one of the page's buttons or links, or reaches a page), the versions with their share of visitors (even by default; "Change how visitors are split" reveals the numbers), **Start test** and **Pause**.
- **Results**: visitors, successes and the success rate per version, the difference from the original, and one sentence per version: "B is ahead, but it's too early to be sure", "B is better: about 98% sure", "B is worse: …", "about the same so far". Below 100 visitors on each version and 20 successes in all it says it's too early and why. **Make Version B the page** publishes B as the page's design and ends the test (only for people who can publish); **Keep the original** ends it and leaves the page alone.
- **On the website** the version is chosen on the server, before the page is drawn, so nothing flickers. Nothing is stored to choose it: the same browser on the same network keeps its version. Search engines and other automated visitors, and browsers with Do Not Track or Global Privacy Control, always get the original and are never counted. Counting uses one first-party localStorage key with only the test and version letter.
- **Permission:** `experiments:manage` (Run A/B tests). Every table has `tenantId`. Migration `0029_experiments`. Decision record: `docs/decisions/0044-ab-testing.md` (assignment, counting, the statistics, and the seam for first-party analytics).

**Tests:**

- core `experiments/visitor-assignment.test.ts` (7): the same version on every visit; an even split and an 80/20 split over 10,000 visitors; three versions; a new secret splits afresh; search engines, previews, tools and headless browsers always get the original; DNT and GPC always get the original.
- core `experiments/experiment-statistics.test.ts` (11): log-gamma; identical versions are a coin toss; agreement with the normal approximation; symmetry; very large tests; better, worse, too early, too close and no data; the minimum sample.
- core `experiments/experiments.test.ts` (11): Version B is a copy, one test per page, up to three versions; no start without a goal; the server chooses the version, the same one on every visit, with the marker and script and a private cache header; bots and opted-out browsers get the original with no script; counting visits and goals, never from opted-out or automated browsers or for versions a test hasn't; pausing shows the original and stops counting; a section version follows later changes to the rest of the page; Make B the page publishes it and ends the test; someone who can't publish can only keep the original; the permission; plugin off ships nothing and counts nothing.
- builder `site-behaviours/form-behaviours.test.ts` (2): a sent form tells the page (`lintel:form-sent`), a refused one doesn't.
- admin `experiments/Experiments.test.tsx` (10): verdict sentences, signed differences, links on the versions, a section version drawn in the current page with the rest locked, the section around a selection, the list and its empty state, results with a verdict and Make B the page, the too-early warning with publishing hidden from people who can't publish, choosing a goal.

**Checked in a browser** (Chromium, on a copy of the styles test data with the private reference pages unpublished and out of the menu): the designer at desktop (Try another version, then Original | B), the test screen at desktop light and dark and at 390px light and dark (not started, too early, a clear result), the list, and the published home page at 390px as Version B for a phone browser (the headless browser itself got the original with no script, as a bot should).

**Screenshots** (in `screenshots/ab-testing/`): `designer-try`, `designer-version-b`, `experiment-draft-light`, `experiment-early-desktop-light`, `experiment-strong-desktop-{light,dark}`, `experiment-strong-phone-{light,dark}`, `experiments-list-light`, `site-version-b-390`.

## Built-in visitor counts

**Asked for:** visitor counts built into Lintel, private by design and with no third party: a calm Visitors screen, a dashboard card, per-page figures in the editor and the builder, goals from forms and the shop, and a way for strict sites to count only after consent.

**Now:**

- **Visitors plugin** (`analytics`, Build → Features), on for new sites. Published pages get a small beacon while it is on; it keeps nothing in the browser. Views (path without query), where people came from (referring domain or `utm_source`), `utm_campaign`, phone/tablet/computer, country from the browser's language, time on page (one "leave" event), links to other sites and named events (`lintelAnalytics.track("name")`).
- **Privacy:** no cookies or storage; the address and browser only make a daily hash with a random salt that is deleted each day, so visitors can't be identified or followed from one day to the next. Do Not Track, Global Privacy Control and robots aren't counted; reloads and floods are limited. Single visits are kept 30 days by default (a setting), daily totals for good.
- **Goals:** forms sent and orders paid, recorded by the server from `form.submitted` and `order.paid`; conversion rate is goals per 100 visitors.
- **Visitors screen:** Today / 7 days / 30 days / Custom, four figures compared with the period before in words ("Up 28% on the previous period"), visitors each day as bars or a table, top pages ("Home page" for `/`), where people came from ("Typed in or bookmarked"), devices, countries, goals, and campaigns, events and outside links only when there are any. Export as CSV. Settings: "Count visitors only after they accept" and how long single visits are kept.
- **Elsewhere:** a Visitors card on new dashboards, a Visitors panel in the entry editor (the page's last 7 days), and "128 visitors this week" in the builder's toolbar.
- **Permission** `analytics:read`: Owners, Admins and Editors.
- **Consent hook:** with the strict setting the beacon waits for `window.lintelConsent.allows("plugin:analytics")`, the `lintel:consent` event listing `plugin:analytics`, or `lintelAnalytics.consent()`.
- Also: the website now passes the visitor's real address to its forms and shop APIs (so per-address limits and the visitor hash tell visitors apart), and follows `TRUST_PROXY` like the API.

Decision record: `docs/decisions/0042-built-in-visitor-counts.md`. Migration: `0030_analytics` (three tables, each with `tenant_id` and `site_id` where it applies).

**Tests:** core `analytics/analytics.test.ts` (16: off means 404, the script, counting every dimension, nothing identifying stored, DNT/GPC/robots, no linking across days and old salts deleted, form and order goals with conversion rate, no goals while off, comparison and custom ranges, retention keeps daily totals, permissions, CSV without formulas, an entry's page, the beacon on public pages only and with the consent flag, counting through the website's address per visitor, the experiments seam), `analytics/visitor-signals.test.ts` (14); updated plugin, roles and setup tests for the new plugin. Admin `analytics/Visitors.test.tsx` (6).

**Checked in a browser** (Chromium): real visits to the published site from four browsers (desktop, phone, tablet; referrers, a campaign link, three languages) showed up on the Visitors screen; a click to another page sent the time on page.

**Screenshots** (in `screenshots/analytics/`): `visitors-desktop-light`, `visitors-desktop-dark`, `visitors-390-light`.

## Per-site styles and motion (3 November 2026)

**Asked:** on an install with several sites, Site styles (design variables, shared styles, tag styles) and site motion (cursor, smooth scrolling, page transitions, intro) should belong to each site, like its fonts and its navigation and footer already do.

**Before:** both were one settings row for every site, so changing the French site's brand colour or cursor changed the main site's too, and applying a template to one site gave its motion and variables to all of them.

**Now:** they are kept per site (`siteDesign:<site id>`, `siteEffects:<site id>`). `/website/design` and `/website/effects` work on the site being edited (the `Lintel-Site` header, as `/website/sections` does), the website draws each site with its own, and a template's motion and variables go to the site being edited only. A site that has not saved its own yet reads the old shared row, so existing installs look the same. Permissions are unchanged, and someone limited to some sites can't read or change another site's. No migration. See decision 0045.

The admin needed no change: it already sends the current site with every request and reloads everything when the site is switched.

Files: `packages/core/src/site-design/*`, `packages/core/src/site-effects/*`, `packages/core/src/website/site-context.service.ts`, `packages/core/src/starter-sites/starter-sites.service.ts`, `docs/decisions/0045-site-styles-and-motion-per-site.md`, `packages/docs/src/content/docs/building/effects-api.md`.

**Tests:** core `site-design.test.ts` "with several sites" (3): two sites' stylesheets carry their own variables; the old shared row shows on every site until one saves its own; permissions and site access. `site-effects.test.ts` "with several sites" (3): two sites' pages load different effect modules; the old shared row; permissions and site access. `starter-sites.test.ts`: applying Studio to a second site leaves the main site's motion and design as they were.

No screenshots: no UI changed.

## One builder for everyone, and one Arrange control (3 November 2026)

Fixes LINTEL-UX-060 and LINTEL-UX-061. Decision: [0046](../decisions/0046-one-builder-for-everyone.md).

**Asked (Daniel):** "remove the developer, designer, beginner stuff. should all just be 1, we'll just need to expand the tour. If they are a dev, they can use the files in vs code for example." And: merge the two stacked arrange controls on sections, boxes and containers into one.

**Reproduced:** the toolbar's **Tools: Beginner** menu; Beginners get a tip pointing to Designer instead of the Simple/Advanced switch, no timeline, and a different tour; the Code tab shows only for Developers. A section shows **Arrange → Place things: In order / On a grid / Anywhere** above **Layout → Arrange what's inside: Stack / Row / Grid / Normal** (`before-{light,dark}-2-style`, `before-{light,dark}-3-panel`).

**Now:**

- No skill levels and no Tools menu. Everyone gets the Style panel's Simple/Advanced switch (kept in the panel; Simple stays short) and Animate's timeline. A stored `skillLevel` is ignored.
- No Code tab. The Code element stays behind `builder:code`: with it, its HTML, CSS and JavaScript are edited in **Content** (Save code). Developers use Liquid templates with `lintel templates init/sync`.
- One tour of eight short steps: Insert and Layers, select and type, Style and which look, Site styles and shared styles, Layout, Animate, screen sizes and History, Publish. First-time tips in Style and Animate, closed with Got it, back from Help and tips.
- Layout has one control, **How things are arranged**: One under another, Side by side, On a grid, Anywhere (sections, boxes and containers), with the chosen one's details under it: where things sit, space between, wrapping, columns, **Place each thing on the grid yourself** (a placed grid), and phones for Anywhere. An element's own place in its parent is **Where it sits**. "Normal" is gone: plain block layout shows as One under another and is only made a stack when one of its details changes, so existing pages render identically. Summaries read "One under another · gap L", "Side by side", "On a grid · 3 columns".

Judgement calls: the Simple/Advanced switch stays as it was rather than becoming "More options" links per group (one familiar control, fewer words). "On a grid" fills in order by default; placing things by hand is a checkbox under it, since it is the less common choice. Switching to or from Anywhere or a placed grid is two History steps.

Files: `packages/builder/src/PageBuilder.tsx`, `frame/Toolbar.tsx`, `panels/SelectedElementPanel.tsx`, `panels/ContentPanel.tsx`, `code-block/` (new: `CodeBlockEditor.tsx`), `style-panel/LayoutSection.tsx`, `ArrangeSection.tsx`, `StylePanel.tsx`, `style-summaries.ts`, `animate-panel/AnimatePanel.tsx`, `tour/tour-steps.ts`, `tour/GuidedTour.tsx`, `ui/controls.tsx` (`twoColumns` on ChoiceGroup), `editor/useBuilder.ts`, the strings files; removed `skill-level/` and `developer/`. Docs: `using/getting-around-the-builder.md` (was builder-skill-levels), `using/animating-in-the-builder.md`; `builder:code`'s description in `core/src/roles/permission-catalog.ts`.

**Tests:** builder `style-panel/layout-section.test.tsx` (new, 7: stored values map onto the four choices; no Place things or Normal; block layout untouched until a detail changes, then a stack; side by side with wrapping; Anywhere and back; grid columns and placing by hand on and off; no Anywhere on a card); `studio.test.tsx` (no Tools menu, a stored level ignored, every style and the timeline for everyone; no Code tab even with permission; first-time tips; the eight-step tour); `PageBuilder.test.tsx` (Code element edited in Content with permission, not without); updated `advanced-styling`, `panels`, `site-design`, `style-summaries` tests. Builder unit 41 files / 346 tests, browser 10 files / 33 tests; admin 140 files / 746 tests (one timing test passes on its own); core roles 14.

**Screenshots** (`screenshots/one-builder/`): `before-{light,dark}-{1-tour,2-style,3-panel}`, `after-{light,dark}-{1-tour,1b-tour-arrange,2-style,3-panel,4-grid,5-animate}`.

Commit: ffa3dd8.

## UI and accessibility sweep fixes (3 November 2026)

Branch `fix/a11y-sweep`. Bugs LINTEL-A11Y-020 to 038 in `BUG-REPORT.md`. Each was reproduced from the sweep's screenshots and notes first, then fixed with the smallest change that works. Screenshots are in `screenshots/a11y-sweep/` (the "before" pictures are the sweep's own). Test data: a copy of the styles data with the private reference pages moved to the recycle bin, so they show nowhere.

- **LINTEL-A11Y-020, the entry editor's bar at 390px.** Below `md` the sticky bar now also covers the strip with the fixed menu and help buttons, and sits under them (`max-md:z-10`, `max-md:pt-14`), so its row starts below the buttons and scrolled content never shows through. Desktop is unchanged. Test: `EntryEditorBar.test.tsx`. Screenshots: `01-entry-bar-390-{before,after}`.
- **LINTEL-A11Y-021, the form editor at 390px.** The fields grid has one `minmax(0,1fr)` column below `lg`, so a long field name can't widen it. Measured: the page is 390px wide, not 607px. Screenshots: `02-form-editor-390-{before,after}`.
- **LINTEL-A11Y-022, contrast of tertiary text and green badges.** `label-tertiary` is #6b655c in light (5.25:1 on the page, 5.72:1 on cards) and #9d978d in dark (about 6.5:1 and 5.4:1 or more). `success` is #1b6c2f in light, so 12px badge text is 4.8:1 or more on its tint. The builder and the motion editor use the same tokens (`@source` in `styles.css`). Test: `colourContrast.test.ts` reads the values from `styles.css` and checks both schemes. Screenshots: `03-14-dashboard-light-{before,after}`, `03-dashboard-dark-{before,after}`.
- **LINTEL-A11Y-023, the phone menu.** While it's open, the skip link, the menu button, the help button and notifications are `inert` along with the page, and the sidebar is `role="dialog"` with `aria-modal` and a name. When it's closed it's the usual landmark. Focus goes back to the menu button once the menu has closed (it is inert until then). In the browser Tab stays in the menu. Test: `AdminLayout.test.tsx`. Screenshots: `04-phone-menu-{before,after}`.
- **LINTEL-A11Y-024, links in the consent notice.** The rule is `.lintel-consent .lintel-consent__text a` (two classes, not `:where()`), with `color: inherit` and an underline, so a site's `a { color }` no longer wins. It is now white on the black notice. Only this rule changed. Test: `element-stylesheet.test.ts`. Screenshots: `05-16-consent-notice-{before,after}` (the site's link colour set to cobalt).
- **LINTEL-A11Y-025, the focus ring.** `focus-ring` and `focus-ring-inset` mix 60% of the accent (4.3:1 against the page in light, 5.8:1 or more in dark). `focus-ring-danger` mixes 80% (3:1 or more in both). Test: `colourContrast.test.ts` reads each utility's mix from `styles.css`. Screenshots: `06-focus-ring-before`, `06-focus-ring-{light,dark}-after`.
- **LINTEL-A11Y-026, shared style tiles.** The builder reads the site's theme values from its stylesheet (`site-design/theme-token-values.ts`, given to the site design context by `PageBuilder`), so a tile using `var(--lintel-color-brand)` shows the site's brand. With the brand set to cobalt the Button tile is cobalt. Test: `shared-style-preview.test.tsx`. Screenshots: `07-shared-style-preview-{before,after}`.
- **LINTEL-A11Y-027, Studio's effects.** The home page had 12 effects (a "View" cursor word and a picture on each of six rows), so adding any one tripped the "more than 12" warning. The "View" word now sits once on the project list instead of on each row. It looks and works the same, and the page has 7 effects. Tests: `studio.test.ts` (the word is on the list; every Studio page leaves room under the mark).
- **LINTEL-A11Y-028, the help panel's pictures.** All 13 in `packages/docs/src/assets/screens/` were retaken from the current admin. They use the same file names and sizes, light mode, and a fresh "Harbour & Hill Bakery" install. Where the screens themselves changed, the pictures show the new screen: Content is now the tree workspace, Pages is the list view, and the editor's panel shows Status and Search engines. Docs tests pass.
- **LINTEL-A11Y-029, Tab into the canvas.** The canvas frame has `tabindex="-1"`, which takes it and everything in it out of the Tab order. Clicking still selects, and Layers is the keyboard way to each element. In the browser, 80 Tabs through the builder never entered the frame. Test: `Canvas.test.tsx`.
- **LINTEL-A11Y-030, the help panel at 390px.** On a phone the panel is `role="dialog"`, `aria-modal`, named by its heading, and the rest of the page is inert (`design/inertOutside.ts`). Escape closes it from anywhere, and focus goes back to the help button. On a laptop it stays a non-modal side panel. Tests: `HelpLauncher.test.tsx` ("on a phone") and `inertOutside.test.ts`. Screenshots: `12-help-panel-390-{before,after}`.
- **LINTEL-A11Y-031, "Create something new".** The Name field appears once the content types have loaded, after the dialog has opened, so it now takes focus then (once). Test: `ContentTree.test.tsx` (it failed without the fix). Screenshots: `13-create-dialog-{before,after}`.
- **LINTEL-A11Y-032, the dashboard.** "Open the media library" is its own width. Outside Edit mode, the last widget in a row takes the columns left at its end (`columnSpans` in `dashboardLayout.ts`), so Updates and Sales fill their row. In Edit mode each widget shows at its own size, to match the size control. Test: `dashboardLayout.test.ts`. Screenshots: `03-14-dashboard-light-{before,after}`.
- **LINTEL-A11Y-033, the automatic site header.** On a designed page the bar runs the full width with the site gutter (`--lintel-site-gutter`, the same `clamp(1.25rem, 3.5vw, 3rem)` the full-width starter sites use). The name and the last link's text line up with the sections' edges: 48px at 1440, 20px at 390. On a phone, a menu without drop-downs stays on one row next to the name and scrolls sideways if it's long, with room left for the focus outline. Menus with drop-downs still wrap, because scrolling would clip them. Test: `chrome.test.tsx`. Screenshots: `15-site-header-{desktop,390}-{before,after}`.
- **LINTEL-A11Y-034, "Load Video".** The video button says "Play" and the title in sentence case ("Play video", "Play our bakery"). A title that starts with an acronym or a name such as "YouTube" keeps its capitals (`inSentence`). Maps and other embeds say "Load …". Test: `elements.test.tsx`.
- **LINTEL-A11Y-035, the builder tour and Escape.** The tour opens with the builder, while nothing has focus. When it closes, focus now goes to the Insert tab, where the tour starts, instead of the body. If something had focus before, focus still goes back to it. Test: `studio.test.tsx`. In the browser, focus lands on `lintel-left-tab-insert`.
- **LINTEL-A11Y-036, group headings.** `GroupedList` headers are headings: `h2` by default, `h3` with `headingLevel={3}`. The help panel's topic list uses `h3`, under the panel's `h2`. History's days ("Today") are `h3` under the panel's `h2` "History". Tests: `GroupedList.test.tsx`, `RevisionHistory.test.tsx`.
- **LINTEL-A11Y-037, the sign-in error.** The message sits by the fields, above Sign in. It's still always rendered as a status region, and takes no room while empty. Test: `SignInForm.test.tsx`. Screenshots: `19-sign-in-error-{before,after}`.
- **LINTEL-A11Y-038, the hover picture switch.** The builder's `ToggleField` is now a switch button drawn like the admin's Toggle (a pill with a knob), with `aria-checked`. This changes "Show a picture when hovered" and every other on/off field in the builder. Test: `pointer-fields.test.tsx`. Screenshots: `20-pointer-switch-{before,after}`.

**Not done (needs Daniel):** the motion panel's moment colours.

**Checks:** format, lint, typecheck and build pass for builder-model, site-components, builder and admin. Tests: builder-model 286, site-components 45, builder 347, admin 763 and docs 13 all pass.

## UX sweep fixes (3 November 2026)

Findings from the hands-on UX sweep, fixed on `fix/ux-sweep`. Each was reproduced from the sweep's steps first; the "before" screenshots are the sweep's own. Screenshots are in `screenshots/ux-sweep/`, desktop light, and 390px where layout was the problem.

**LINTEL-UX-045: a new navigation goes live everywhere.** The builder's note now says "This navigation is now live on every page of your website" (and the same for a footer), with an Undo that takes it off the site again, back to the automatic header. Files: `builder/src/i18n/site-section-strings.ts`, `PageBuilder.tsx`. Tests: builder `site-sections.test.tsx` (the note's words; Undo sends `{ navigation: null }` and the note goes). Screenshots: `045-nav-note-{before,after}`.

**LINTEL-UX-046: a navigation on an empty page was hidden.** The canvas shows whenever the page has anything in it, the site's navigation included; while the page has nothing of its own, the start card sits over the canvas below the navigation. Files: `PageBuilder.tsx` (`isBlank` beside `showsStart`), `frame/EmptyPage.tsx` (`belowSiteSections`). Test: `site-sections.test.tsx` (after adding a navigation to an empty page, the canvas and the start card both show). Screenshots: `046-empty-page-nav-{before,after}`.

**LINTEL-UX-047: no way to remove the site's navigation.** Deleting the site's navigation or footer (the Delete key in Layers, or "Remove…" on the strip above the canvas) asks "Hide on this page" or "Remove from every page", which says the site goes back to its automatic header or footer. Removing takes the section out of the page, so the builder sends `PUT /website/sections` with null for that slot; Undo brings it back. People who may not change the site's sections only get Hide. Files: `editor/site-section-commands.ts` (`removeSiteSectionFromSite`), `editor/useBuilder.ts`, `site-sections/SiteSectionControls.tsx` (`SiteSectionRemoveDialog`, the strip's Remove), `PageBuilder.tsx`. Tests: `site-sections.test.tsx` (the command and its undo; the question from the Delete key sends null; Hide from the same question keeps the site's). Checked in the browser: after "Remove from every page", `GET /website/sections` answers `{"navigation":null,"footer":null}`. Screenshots: `047-remove-nav-{before,after}`.

**LINTEL-UX-048: the Design card's heading one word per line.** The words keep a basis of 14rem, so in a narrow column the button wraps below them. File: `admin/src/page-design/PageDesignCard.tsx`. Test: `DesignFirstFields.test.tsx`. Screenshots: `048-design-card-{before,after}`, `048-design-card-after-390`.

**LINTEL-UX-049: Move… listed nothing to pick.** Before anything is typed it lists the tree's top level and the pages under each (the home page's pages), indented; what is moving is left out. Files: `content-tree/MoveDialog.tsx`, `contentTree.queries.ts` (`useMoveTargets`). Test: `ContentTree.test.tsx`. Screenshots: `049-move-dialog-{before,after}`.

**LINTEL-UX-050: Pages stayed folded.** Choosing the site's pages (the first page tree), from the tree or by its address, unfolds it and its home page. File: `content-tree/ContentTree.tsx`. Test: `ContentTree.test.tsx` (opening `/content/pages` shows Home and its About). Screenshots: `050-pages-unfold-{before,after}`.

**LINTEL-UX-051: Open and Current for every element.** In the simple panel Open shows only for elements that can open (a button, something with a button in it, an accordion, a pop-up, or anything inside one that already opens) and Current only for links, menus, breadcrumbs and tabs, or what is inside them. A look already in use always shows; Advanced and Designer keep all six. Beginner still offers Normal, Hovered, Pressed and Focused (narrowing it further is Daniel's call). Files: `builder/src/style-panel/relevant-looks.ts`, `StylePanel.tsx`, `panels/SelectedElementPanel.tsx`. Tests: `relevant-looks.test.ts`, `panels.test.tsx`. Screenshots: `051-looks-before`, `051-looks-after` (a heading), `051-looks-button-after`.

**LINTEL-UX-052: "Template" and the ticked pairing.** The choice is now "Blog and page style". While a heading or body font of the site's own is chosen, no pairing is ticked and a "Your own fonts" row says so; picking a pairing uses its fonts again (it clears the two below). Files: `admin/src/website/SiteSettingsPage.tsx`, `FontPairingChoice.tsx`, `i18n/strings.ts`. Test: `SiteSettingsPage.test.tsx`. Screenshots: `052-your-website-{before,after}`.

**LINTEL-UX-053: the email warning was a dead end.** It now adds "Ask whoever set up your website to connect an email service." and a "How emails work" link to the forms help, which gained a paragraph on it. Files: `forms/FormSettingsSection.tsx`, `forms/formsStrings.ts`, `docs/src/content/docs/using/forms.md`. Test: `FormSettingsSection.test.tsx`. Screenshots: `053-form-email-{before,after}`.

**LINTEL-UX-054: the picture panel.** A built-in illustration (`/_lintel/...`) loads from the website's address, as the template cards do, and its path is replaced by "A built-in illustration. Change it for a photo of your own." The element's heading is left out when its first group says the same ("Picture"), and the field's label is kept for screen readers only when the group above says it. Files: `builder/src/panels/content-fields.tsx` (`PictureBaseUrlContext`, `picturePreviewSrc`), `panels/ContentPanel.tsx`, `ui/controls.tsx` (`labelHidden`), `PageBuilder.tsx`. Tests: `panels.test.tsx`. Screenshots: `054-picture-content-{before,after}`.

**LINTEL-UX-055: one name for alt text.** "Picture description" everywhere: the builder's field, rich text pictures, the media library's details (hint: "For people who can't see it, and for search engines."), the media search ("Name or picture description"), the picker ("No picture description yet") and the dashboard ("N pictures need a description"). Files: `builder-model` component labels, `builder/src/i18n/element-strings.ts`, `admin/src/i18n/strings.ts`, `dashboardStrings.ts`, `fields/richTextPictureStrings.ts`. Tests: `RichTextPictures.test.tsx`, `MediaLibraryPage.test.tsx`. Screenshot: `055-picture-description-after`.

**LINTEL-UX-056: grid columns only while dragging.** The columns of a placed grid are drawn, quietly, while the grid or something on it is selected. File: `builder/src/canvas/canvas-frame-script.ts` (`drawSelectedGridColumns`). Test: builder browser test `canvas-placed-grid.test.ts` (ten columns in the right places with the grid selected, and with an element on it). Screenshots: `056-grid-columns-{before,after}`.

**LINTEL-UX-057: Rename in the tree.** "Rename…" in a page's menu changes its title; its address stays. Files: `content-tree/RenameDialog.tsx`, `treeActions.ts`, `useActionItems.ts`, `TreeDialogs.tsx`. Tests: `ContentTree.test.tsx`, `treeActions.test.ts`. Screenshots: `057-rename-before`, `057-rename-menu-after`, `057-rename-dialog-after`.

**LINTEL-UX-058: telling binned items apart.** Each item shows where it was ("Was at /about") and the first pages that were under it ("Under it: Team, History and 2 more"). The address is worked out when the item is binned and kept in the stored branch (no migration; items binned before have none); the titles under it are read from the branch in the list query. Files: `core/src/recycle-bin/recycle-bin.service.ts`, `recycle-bin.repository.ts`, `recycle-bin.table.ts` (the branch's type only), `admin/src/content-tree/RecycleBinPage.tsx`. Tests: core `recycle-bin.test.ts`, admin `RecycleBinPage.test.tsx`. Screenshot: `058-recycle-bin-after`.

**LINTEL-UX-059: pictures needing a description.** `GET /media?missingAlt=true` lists only pictures with no description; the library has a "No description" choice beside All, Images and Documents, and the dashboard's "N pictures need a description" links to it (`/media?filter=needs-description`). "Needs a description" didn't fit at 390px, so the choice says "No description". Files: `core/src/media/media.schema.ts`, `media.repository.ts`, `media.service.ts`, `admin/src/media/MediaLibraryPage.tsx`, `media.api.ts`, `media.queries.ts`, `router.tsx`, `dashboard/widgets/MediaUsageWidget.tsx`. Tests: core `media-library.test.ts`, admin `MediaLibraryPage.test.tsx`, `DashboardPage.test.tsx`. Screenshots: `059-no-description-filter-after`, `059-no-description-filter-after-390`, `059-dashboard-link-after`.

**LINTEL-UX-070: Design and Templates.** The sidebar says Templates, as the page does. No "In use" badge: the site doesn't record which template it started from (starting from one only adds pages and, if asked, its colours and fonts), so there's nothing to mark. File: `admin/src/i18n/strings.ts`. Test: `navigation/sections.test.ts`. Screenshots: `060-templates-{before,after}`.

**LINTEL-UX-071: forms wording.** "Form element" everywhere (the builder calls it an element), and the embed code and the API are one folded "For developers" card, with "On any other website" and "Through the API" inside. Files: `forms/FormBuilderPage.tsx`, `forms/formsStrings.ts`. Test: `FormsScreens.test.tsx`. Screenshots: `061-form-share-{before,after}`.

**LINTEL-UX-072: "Lintel" in the site fonts' words.** They use `{product}` like the rest of the admin. File: `admin/src/site-fonts/siteFontsStrings.ts`. Test: `i18n/copyFixes.test.ts` (no site fonts string says Lintel; "Acme Studio also includes 23 fonts…"). No screenshot: the words read the same in an admin that isn't white-labelled.

**LINTEL-UX-073: Site styles for beginners.** In Beginner a colour's row shows its swatch without the codes, and its editor keeps the swatches under "In light mode" and "In dark mode" without the code boxes; Designer still shows them. The suggested size is now "Side space" rather than "Gutter" (a site that already has a size called Gutter keeps its own name). Files: `builder/src/site-design/SiteStylesPanel.tsx`, `panels/SelectedElementPanel.tsx`, `i18n/site-styles-strings.ts`. Tests: `site-styles.test.tsx`. Screenshots: `063-site-styles-{before,after}`.

**LINTEL-UX-074: Create with one choice.** With only one content type allowed there is no question; the title names it in the singular ("New page in Home", from its blueprint). File: `content-tree/CreateDialog.tsx`. Tests: `ContentTree.test.tsx`, `menus/PageMenuSection.test.tsx`. Screenshots: `064-create-dialog-{before,after}`.

**LINTEL-UX-075: "just you" with an invitation waiting.** It says "Just you for now, with one invitation waiting to be accepted." Files: `admin/src/people/UsersPage.tsx`, `i18n/peopleStrings.ts`. Test: `UsersPage.test.tsx`. Screenshots: `065-users-{before,after}`.

**LINTEL-UX-076: chips and the real look.** A weight set near a chip presses it (600 reads Bold) instead of "Custom"; a grid's Columns choice counts any template ("1fr 1fr" is 2) and, with none set, the columns the canvas draws (the frame now reports them). The size chips had a bug too: the measured look could never press Normal, because a default value turned its `undefined` into "unknown"; a 17px button now shows Normal. Files: `builder/src/style-panel/canvas-look.ts` (`nearestWeightChip`, `countGridColumns`), `StyleInputs.tsx` (`matchValue`), `TypographySection.tsx`, `LayoutSection.tsx`, `canvas/canvas-frame-script.ts`, `canvas/canvas-messages.ts`, `PageBuilder.tsx`. Tests: `canvas-look.test.ts`, `panels.test.tsx`. Screenshots: `066-style-chips-{before,after}`.

**Judgement calls:** the Undo on the "now live" note removes the navigation from the site rather than stepping back through history, so it does what it says even after other changes. Choosing a font pairing clears fonts chosen below, since a ticked pairing should mean its fonts are in use. The media filter says "No description" to fit at 390px.

Commits: b679c01 (builder), 9835555 (admin and core).

## Code review fixes (3 November 2026)

Branch `fix/review-findings` from `release/1.0.0-rc`. The defects are LINTEL-CODE-001 to 016 in `BUG-REPORT.md`. Each was checked against the code first, and each fix has a regression test that fails without it. No migration was needed: the new state lives in settings rows. Decision record: `0048-shared-sections-wait-for-publish.md`.

- **LINTEL-CODE-001 (P1), a template replaced the site's menu and footer.** When pages are added beside the site's own, a template's navigation and footer are only used if the site has never had any. They replace the site's only when the template's look is applied, none of the site's pages stay, and the person may change blocks. The replaced ones are kept in `siteSectionsBeforeTemplate:<site id>`. `POST /website/sections/restore-previous` brings them back, and running it again swaps back. The apply response says `previousSectionsKept`. The switch now reads "Use this template's colours, fonts, menu and footer, and motion for the website". Tests: `site-sections.test.ts` (alongside keeps them; replace keeps and restores them; nothing to restore; no `builder:blocks`, no replace). Commit 8d00a64.
- **LINTEL-CODE-002 (P1), `lintel:page/<id>` links on the published site.** The navigation and footer (also used by Liquid's `{% site_header %}` and `{% site_footer %}`) and the designs of the site's own blocks now have their page links swapped for the published page's address before they are drawn (`website/page-link-addresses.ts`). Links to pages that aren't published are left empty, as delivery does. Tests: `site-sections.test.ts`, a button in each, on the published site. Commit 8c33d90.
- **LINTEL-CODE-007 (P2), every "/…" link got the site's prefix and language.** Typed addresses in the navigation and footer keep the website's language only when they are pages. Lintel's files (`/_lintel/…`), files (`/menu.pdf`) and addresses that already name a language are left alone (`isPageAddress`). Tests: `site-sections-drawing.test.ts`, and the published-site test above. Commit 8c33d90.
- **LINTEL-CODE-003 (P2), rich-text pictures had no photo credit.** They now show the credit as `{% image %}` and the Picture element do (`renderFigureCaptionHtml` in site-components, after the caption or on its own). Test: `rich-text-pictures.test.ts`. Commit 18ad78b.
- **LINTEL-CODE-004, 005 and 006 (P2), saving the site's styles, navigation and footer.**
  - The styles hook saves a waiting change when the builder closes.
  - Both hooks save one change at a time and keep a failed change for the next try.
  - A failed save shows at the top of the builder with Try again (`SitePartProblems`).
  - `GET /website/design` now gives a `revision`. A `PUT` that sends the revision it read gets 409 `SITE_DESIGN_CHANGED` if someone saved since. The builder then shows the newer styles and says "Someone else changed the site's styles while you were working, so your last change wasn't saved."
  - The navigation and footer didn't get the same check. Their PUT only changes the slots it sends, so a stale copy can't wipe the other slot. With LINTEL-CODE-016, changes are drafts until published.
  - Tests: `site-design.test.ts` (409 on a stale copy) and admin `siteParts.test.tsx` (saved on close, failure shown and retried, newer styles shown).
  - Commit d91b2a9.
- **LINTEL-CODE-008 (P3), fonts.**
  - Google Fonts files download four at a time.
  - If any fails, or the family can't be added, the files already downloaded for it are deleted.
  - Files a new download replaced are deleted once no font uses them.
  - A site can have 40 fonts (409 `TOO_MANY_SITE_FONTS`). An Adobe project with more adds the first ones.
  - Counting and adding a font happen in one transaction. A unique-name violation becomes "already has a font called…".
  - The file cache is bounded at 32 MB.
  - Adding uploaded fonts takes the format from the file's type, without reading the file. Inspecting reads files one at a time.
  - Tests: `site-fonts.test.ts` (failed download leaves nothing; replaced files deleted; 40 fonts; same-name race) and `google-fonts-client.test.ts` (byte-bounded cache; four at a time).
  - The two reading changes are covered by the existing upload and inspect tests, which still pass.
  - Commit 0b7d2e7.
- **LINTEL-CODE-009 (P3), hover picture.** The builder stores the picture's `assetId` with it, and the website asks the media server for a 720px WebP copy. The picture is fetched the first time the pointer comes over the element, not when the page opens. Tests: motion browser test "the hover picture's file" and builder `pointer-fields.test.tsx`. Commit 2d7df31.
- **LINTEL-CODE-010 (P3), page transitions read every element's styles.** Elements carried across pages are marked `data-lintel-carried="<name>"` when the page is drawn (`elementAttributes` on effect definitions). The page's script reads only those and no computed styles. On the way, elements whose only effects are style effects now get their `data-node-id` on the website. Before, their CSS had nothing to match. Tests: builder `render-page.test.tsx`; motion browser test (no `getComputedStyle` calls when leaving). Commit a1a9b05.
- **LINTEL-CODE-011 (P3), smooth scrolling read styles on every wheel step.**
  - It checks whether the wheel belongs to an inner area, or the page is locked, once at the start of a glide.
  - It checks again only when the wheel moves to another element or turns round.
  - A click or a key, as when a pop-up opens, ends the glide.
  - A MutationObserver cache was tried. It pushed the runtime over its 10 KB budget, so it wasn't kept.
  - Tests: `smoothScroll.test.ts`, styles read once a glide. All 67 motion browser tests pass. Effect module sizes were measured again.
  - Commit 7fe23a1.
- **LINTEL-CODE-012 (P3), "Skip intro" was always English.** The words are now a site label, `skipIntro`. `siteEffectsHead` needs the labels, and the website and Liquid pages pass theirs. Test: `site-effects.test.ts`. Commit 0fbd152.
- **LINTEL-CODE-013 (P3), rules.** Working out which parts of a site effects change were sent now happens in `updateSiteEffects`. A bad change is a plain 400. Test: `site-effects.test.ts`. Commit 0fbd152.
- **LINTEL-CODE-014 (P2), "We'll add 4 pages" added 3.** `GET /starter-sites/:id/existing-pages` gives `addedCount`. Beside a site with a home page, the template's home page is left out of the count and the clashes. The dialog uses that count and says "The template's home page isn't added; your home page stays." Tests: `starter-sites.test.ts` and `TemplateLibraryPage.test.tsx`. Commit 26f6ee7.
- **LINTEL-CODE-015 (P2), the look switch changed the live site without saying so.** It now reads "Changes your live website now." below it. Daniel's decision: it starts off when the pages go alongside the site's own. It stays on when replacing them, or on a site with no pages. Test: `TemplateLibraryPage.test.tsx`. Commit 26f6ee7.
- **LINTEL-CODE-016 (P2), navigation and footer changes went live at once.** This was Daniel's decision, recorded in 0042.
  - The builder edits a draft (`siteSectionsDraft:<site id>`).
  - The website, Liquid and delivery draw the published sections. Sections stored before count as published.
  - `POST /website/sections/publish` needs `builder:blocks` and `entries:publish`. The page builder's Publish sends it after publishing the page.
  - The top bar says "Navigation and footer changes not live yet" while there are some.
  - A draft that is changed back to the published sections is dropped.
  - Starter templates and restore still change the live sections and drop any draft.
  - The builder's notes now say the navigation or footer goes on every page "when you publish". These strings are in `builder/src/i18n/site-section-strings.ts`, which fix/ux-sweep may also reword.
  - Live preview of an unpublished page still shows the published navigation and footer.
  - Tests: `site-sections.test.ts` (draft until published; nothing to publish after changing back; who may publish) and admin `PageDesignPage.test.tsx` (Publish puts them live; the note).
  - Commit 391057a.

**Checks:**

- Lint and typecheck pass for core, admin, builder, motion and site-components.
- Builds pass for motion, site-components, builder-model and builder.
- Tests:
  - admin: 750 of 751 in the full run. The one failure was a timeout in "opens an empty page with a way to start" while the core suite ran alongside; it passes on its own (9 of 9 in that file).
  - builder: 343.
  - site-components: 44.
  - motion: unit 157 and browser 67.
  - core: 1,239 passed and 6 skipped; the 3 failures (`main.test.ts`, `dev-runtime.test.ts`, `model-sync.test.ts`) are among the known Windows platform failures.
- Screenshots, desktop light, in `docs/qa/screenshots/code-review/`:
  - `code-014-015-template-alongside-after-desktop-light.png`: "We'll add 3 pages", the home-page line, the switch off and "Changes your live website now."
  - `code-015-template-replace-after-desktop-light.png`: replacing, the switch on and the count back to 4.
  - `code-016-unpublished-note-after-desktop-light.png`: the builder's top bar with "Navigation and footer changes not live yet".
- The first top-bar try showed two notes squeezed side by side ("Changes not live yet" and the navigation one). Now only one shows: the page's own note when the page has changes waiting, else the navigation and footer note.

## LINTEL-UX-077: designing the cursor (3 November 2026)

**Asked for by Daniel:** "what if they want to customise the pointer cursor?" Until now the word an element gives the cursor ("View") always looked the same, a site couldn't use its own cursor picture, and over one element the pointer could only show a word or a following picture.

**Now:**

- **Your own picture** is a cursor style in Motion across the site. The picture comes from the media library (an SVG or a small PNG), with its size and where it points: the middle, or the top-left corner like an arrow. Pictures over 64 KB get a note. Until one is chosen, visitors keep the normal pointer. The page loads a copy at the size shown (twice that for sharp screens), never the upload, and addresses are checked: the site or the web only, never `javascript:` or `data:`.
- **The cursor's word** has a look: background and letters (Automatic, the site's own colours, the theme's, or one picked by hand), size and shape (pill, square, circle). It's in a closed group under the cursor settings. Letters left automatic are chosen to read on the background.
- **Try it**: a small sample under the settings where moving the mouse shows the cursor, growing over a link, and the word over a card, with nothing to publish.
- **When the pointer is over it** (Animate tab) is now one choice, showing only the chosen option's fields: Nothing changes, A word on the cursor (with Change its look folded away), A picture follows it, The cursor grows, The cursor becomes a picture (size and point), The cursor hides, The normal pointer (for text people select; the hand still shows over links). "The cursor grows" says so when the site has no custom cursor.
- **Kept:** touch screens never see any of it; keyboard focus rings are untouched; with less motion nothing eases or lags (a cursor picture never lags anyway); the cursor and its picture step aside over an embedded video and come back after (LINTEL-UX-042). Settings saved before this read as the standard look with no picture and draw exactly as before; older elements with both a word and a picture keep both.

Decision record: `docs/decisions/0047-designing-the-cursor.md`. No migration: the settings are JSON in the settings table and read old values with defaults. The cursor module grows by about 2 kB (compressed); `module-sizes.ts` was measured again. The core runtime stays under its 10 kB budget.

**Tests:**

- motion `effects-catalogue/cursor-design.test.ts` (12): old settings read as the standard look and no picture and write no CSS; new sites start with no cursor; word colours accept site and theme variables, hex and Automatic and refuse CSS tricks; script and `data:` picture addresses refused, sizes limited; a picture cursor is only on with a picture; media library addresses sized as PNG; letters chosen for theme, hex and site colours; only what changed is written; an element's look and the new `cursor-over` effect cleaned.
- motion `browser-tests/cursor-design.browser.test.ts` (18, Chromium): the own picture's middle and top-left point land on the pointer (also with less motion); no picture or a script address keeps the normal pointer; the site's word look (brand, readable letters, large, circle); an element's own look without a site cursor; letters for a site colour variable; the old look unchanged; over an element the ring grows, a lone dot grows, the cursor becomes the element's picture with its own point and back, the site's own picture swaps for the element's, the cursor hides with the pointer, the normal pointer returns (text cursor over text, hand over links); without a site cursor a picture becomes the browser's own cursor with its hotspot in the middle, and hide hides the pointer; nothing on touch screens; the picture steps aside over an embedded frame and returns. The existing 18 site-motion browser tests pass unchanged.
- motion-editor `SiteMotionSettings.test.tsx` (+3): choosing Your own picture from the media library, the large-file note, size and point; the word's look in its closed group and in the preview; old settings read as Standard.
- builder `pointer-fields.test.tsx` (4, rewritten): one choice list with only the chosen fields, every option saved as one effect; a cursor picture with size, point and the large-file note; an element's own word look folded away; older pages with both a word and a picture.
- core `site-effects.test.ts` (+2): the word look's CSS without a custom cursor; the picture address sized by the server, and no cursor module until there's a picture.

**Checked in a browser** (Chromium, desktop, light and dark; on a copy of the styles test data with the private reference pages unpublished and out of the menu): the builder's site cursor settings with the preview (word shown, and Your own picture) and the Animate tab's pointer choices (a word with its own look, a cursor picture); a published page with every per-element choice, hovered one by one, with the ring-and-dot cursor and with the site's own picture. Playwright doesn't capture the browser's own cursor, so the page shots show the custom cursor's elements; the normal-pointer row shows none.

**Screenshots** (in `screenshots/cursor-design/`): `builder-site-cursor-word-desktop-{light,dark}`, `builder-site-cursor-picture-desktop-{light,dark}`, `builder-element-word-look-desktop-{light,dark}`, `builder-element-picture-desktop-{light,dark}`, `site-pointer-variants-desktop-light`, `own-picture-pointer-variants-desktop-light`, `site-page-desktop-light`, `own-picture-page-desktop-light`.

**Left for later:** the media library's "where used" doesn't count a cursor picture; the preview doesn't draw the trail; the Animate tab's picture field shows the cursor picture as large as a photo.

## LINTEL-UX-079: the cursor over an open menu drawer (3 November 2026)

**Reported by Daniel:** "the cursor followers isn't visible when mobile menu open".

**Cause:** the menu drawer is a modal `<dialog>`. Browsers draw modal dialogs in the top layer, above everything else on the page whatever its stacking order, so the cursor, its word, the hover picture and the trail were drawn underneath.

**Fix:** a small helper, `motion/src/effects/kit/top-layer.ts` (`attachAboveDialogs`), adds each of them to the page and moves them inside whichever modal dialog is open, then back out when it closes. It watches for dialogs opening and closing, and forgets anything taken off the page. `cursor.module.ts` and `pointer.module.ts` use it everywhere they add something that follows the pointer.

**Test:** `motion/src/browser-tests/cursor-design.browser.test.ts`, "moves the cursor into the open dialog, and back out when it closes", which uses a real modal dialog.

## Docs for today's features (3 November 2026)

**Asked for:** documentation for everything built today, written for website makers first (plain English, task-led), with a short "For developers" note where it helps.

**Checked against:** decision records 0034 to 0048, the sections of this log above, and the running admin (signed in to the test data, with every change request held back so nothing was saved; no private reference pages opened or shown).

**New pages** (in `packages/docs/src/content/docs`):

- `using/fonts.md`: Google Fonts (downloaded and served from the site), your own files (the licence tick), Adobe Fonts (project ID, served by Adobe, waits for consent), and using them for headings, body text and single elements.
- `using/navigation-and-footer.md`: adding one, editing it once for every page, waiting for Publish, Hide on this page, Use as this page's own navigation, Remove from every page, sites without one, templates.
- `using/site-styles.md`: colours, sizes and fonts (with dark-mode colours), shared styles and variants, Every element of a kind, Which look you're changing (Normal, Hovered, Pressed, Focused, Open, Current) and following something around it.
- `using/arranging-things.md`: How things are arranged (One under another, Side by side, On a grid, Anywhere), placing things on the grid for each screen size, and canvas zoom.
- `using/site-motion.md`: smooth scrolling, the cursor and the cursor's word, Your own picture, the per-element pointer choices, page transitions and the first-visit intro.
- `using/cookie-notice.md` (moved out of "Your website" and filled out), `using/visitors.md`, `using/ab-testing.md` and `using/page-drafting.md` (the model, the setup screen, what downloads from where, offline use).
- `hosting/requirements.md`: a server that runs Node.js 22, Postgres or the built-in database today, storage, email, and a few other companies' hosting listed neutrally.

**Updated pages:** `animating-in-the-builder.md` (Add motion by moment and tiles, Start and End lines, Grow from small while scrolling), `getting-around-the-builder.md` (one builder, the eight tour steps as the builder shows them), `templates.md` (Studio, Atelier and Folio; adding alongside or replacing; what the look switch changes and that it starts off when adding alongside), `free-layout.md` (now "Placing things anywhere", reached through Anywhere), `designing-pages.md`, `advanced-styling.md`, `effects.md`, `animating.md`, `website.md`, `sites.md` (what each site keeps for itself), `elements-reference.md` (Clock, Site logo, Cookie settings), `using/index.md` and `hosting/index.md`. Stale words removed: "Style for", "Arrange", "Free layout: place things anywhere", the Code panel, Designer-only timeline, "Footer-style".

**Sidebar:** the new pages sit beside the ones they belong with (`src/sidebar.ts`); the builder pages are now together, and "What it needs" follows "Start here" under Running Lintel.

**Screenshots** (`packages/docs/src/assets/screens/`, 1440 × 900, light, palette PNGs of 22 to 61 KB): `builder-tour`, `insert-navigation`, `navigation-remove`, `site-styles`, `which-look-hovered`, `arrange-on-a-grid`, `add-motion`, `scroll-scene`, `site-motion`, `template-dialog`, `fonts-google`, `cookie-notice-settings`. Visitors, A/B testing and Page drafting are switched off in the test data, and switching them on would change it, so those pages have no screenshot.

**Test:** `packages/docs/src/content.test.ts`, "the docs' wording": no page mentions a hosting service of Lintel's own or a 1.0 release.

**Not done:** the admin's help panel still opens the older pages for Settings → Your website and the new screens (Visitors, A/B tests, Page drafting); pointing those routes at the new pages is a small change in `admin/src/help/helpTopics.ts`, outside the docs.

## Help panel pages for the new screens, and a stale test cache (3 November 2026)

**What changed:** the "?" help on the new admin screens now opens their own pages:

- Visitors (`/visitors`) opens `using/visitors`;
- A/B tests (`/experiments`) opens `using/ab-testing`;
- Settings → Page drafting opens `using/page-drafting`;
- Settings → Your website → Fonts opens `using/fonts`;
- Settings → Your website opens `using/website`.

The mappings are in `admin/src/help/helpTopics.ts`.

**Found on the way:** the admin's help test reported the new docs pages missing even though they were there. Vitest 5 keeps a file cache (`node_modules/.vitest-cache`) that keys a module on its own text only. The docs help bundle reads its pages with `import.meta.glob`, so pages added to the docs were invisible to the admin's tests until the cache was cleared. Stale results like this could hide real failures. The admin's test config now turns that cache off (`fsModuleCache: false`). It's the only package whose tests read files this way.

## Visitors, A/B tests and the cookie notice working together (3 November 2026)

**Asked for:** connect the three plugins that landed apart: Visitors (0042), A/B testing (0044) and the cookie notice (0040).

**What changed:**

- **The cookie notice lists "Visitor counts"** (`plugin:analytics`) while Visitors' "Count visitors only after they accept" is on, so visitors can accept it; with the setting off, counting stays cookieless and the notice doesn't mention it. Plugins can now name services from their settings (`consentServicesFromSettings` in `definePlugin`), read each time the notice is worked out; a service without a handle stands for the plugin itself.
- **A/B tests get the same switch.** Decided that the `lintel-tests` key (a test id and a version letter, first-party) doesn't need consent by default, with the reasons in the decision record. Sites that want every visitor to agree first turn on **Count test visitors only after they accept** (A/B tests → Settings): the notice lists "A/B test counts" (`plugin:experiments`), and the counting script stores and sends nothing until it is allowed, removing an earlier visit's key if it is turned down. Everyone taking part still sees a version, chosen on the server.
- **Goals Visitors counts.** While Visitors is on, a test's goal can be "does something Visitors counts": a particular form, an order, or an event the site sends with `lintelAnalytics.track(...)` (listed once Visitors has counted one in the last 30 days). The page's script spots these in the browser; the beacon now fires `lintel:track` for named events.
- **Page views carry the version shown.** The beacon reads the page's test marker and tags its page view with `{ experiment, variant }`; the daily figures gain a `version` row, and the Visitors screen shows **A/B tests running** (visitors per version of each running test) to people who run tests.
- **A/B keeps its own counts** as the results' source, with or without Visitors: Visitors' single events are deleted after 30 days, its visitor hash changes daily, and goals the server records carry no visitor, so it can't give a test's per-browser numbers. Visitors' version rows are a second view.
- **Privacy on both sides is unchanged:** no cookies, nothing identifying; Do Not Track, Global Privacy Control and robots are excluded by both scripts and both servers, so no version tag is recorded for them.

Decision record: `docs/decisions/0051-visitors-tests-and-the-cookie-notice.md`. No migration: the new setting is plugin settings JSON with defaults, and the new rollup dimension is a value in an existing column.

**Tests:**

- core `experiments/experiments-with-visitors.test.ts` (6, new): "Visitor counts" is in the notice (page and admin) only while Visitors waits for consent, and not once the plugin is off; A/B's setting adds `"consent": "required"` to the page's script settings and "A/B test counts" to the notice, with the version still chosen; both services listed together; a goal Visitors counts is checked and passed to the page's script; tagged page views become per-version rows on the Visitors stats while A/B's own counts stay untouched, and a made-up version is refused; nothing is kept for a browser sending Global Privacy Control.
- core `experiments/tests-script.test.ts` (7, new, jsdom): counts at once without consent; a particular form (not another) and a named event as goals; with consent required, nothing stored or sent until `lintel:consent` allows `plugin:experiments`; counts at once with an earlier choice; an earlier key removed when turned down; nothing for Do Not Track.
- core `analytics/analytics-script.test.ts` (5, new, jsdom): the page view carries the test and version; no tag without a test; `track()` fires `lintel:track`; waits for `plugin:analytics` (not another service); nothing for Do Not Track.
- admin `Experiments.test.tsx` (+3): a form or event Visitors counts as the goal; not offered with Visitors off; the A/B settings dialog saves the consent switch. `Visitors.test.tsx` (+1): the "A/B tests running" card names only running tests' versions, and isn't shown (or fetched) without the A/B permission.
- Full suites: core 1354 passed, 6 skipped (198 files); admin 807 passed (148 files). Lint, typecheck and build clean for core and admin.

**Checked in a browser** (Chromium, desktop, light; on a copy of the styles test data with the private reference pages unpublished and out of the menu): the Visitors screen with the new card, the A/B settings dialog, a test's goal set to a Visitors form, and the website's cookie notice listing "Visitor counts".

**Screenshots** (in `screenshots/measure-wiring/`): `visitors-test-versions-desktop-light`, `experiments-settings-desktop-light`, `experiment-goal-visitors-desktop-light`, `site-cookie-notice-choices-desktop-light`.

**Left for later:** the notice's default sentence says each service "may set cookies", which isn't true of Visitor counts or A/B test counts; a plugin that waits for consent while the notice is Off counts nobody, and the admin doesn't warn about that combination yet.

## LINTEL-UX-078: text and menu effects on hover (3 November 2026)

Decision: [0050](../decisions/0050-menu-links.md).

**Asked (Daniel):** "anyway to do text effects on hover at the moment?", with a mono-type menu (SHOP HOME WORK STUDIO CONTACT) whose current item has a thin circle around it. Then: "What if I want to style them differently? Should it be Menu > Link?"

**Reproduced:** a Menu draws its links itself, so they can't be selected, styled or given an effect; only Site styles → All links → Hovered reached them, for every link on the site. Wave on hover, Bolder on hover and Scramble (set to "When the pointer is over it") existed but were listed under Appears, and Add motion → Hover offered only Lift, Grow and the like. In page designs the Menu never marked the current page (`aria-current`), because the page data passed the main menu unmarked.

**Now:**

- **Menu → Menu link.** Every Menu holds one Menu link in Layers: the look of every link, styled like any element, with its Hovered and Current looks. Its Content sets **When a link is hovered**: only its Hovered look, a line draws in under it, the words roll up, the letters scramble, a circle draws around it, or its colour fades, with a colour from the site's or theme's colours and **Keep it on the current page's link** (on by default). A circle kept on the current page is Daniel's screenshot.
- **One link on its own.** Clicking a link on the canvas selects the Menu link with that link in hand (it is the one outlined); Style then asks **Changes apply to: Every menu link / Only “Contact”**. Only keeps just the changed properties on the Menu link, by menu item id, over the shared look; **Use the shared look** takes them away. Menu items now carry their ids to the page as `data-menu-item`.
- **CSS, no script, except the scramble.** The looks are written with the page; hover rules only apply where the device can hover, keyboard focus gets the same look, and with less motion the change is instant and the words don't roll. The roll up draws a copy of the words with `aria-hidden`. The scramble runs the `scramble-on-hover` effect, so the effects runtime loads only then.
- **Drawer.** A Menu button's drawer in the same part of the page takes the Menu link's look; its links are whole rows, so instead of a circle its current (and focused) link is underlined. Touch shows nothing extra.
- **Roll up and Scramble on hover** are new effects for any text, link or button. Text effects that play under the pointer are now offered under Hover. Add motion → Hover shows six tiles: Lift, Roll up, Underline, Scramble, Wave, Bolder for text; Lift, Grow, Roll up, Underline, Scramble, Wave for links and buttons; others keep Lift, Grow, Brighten, Tilt, Magnetic, Swing. The rest are under More effects…. Effect tiles still work when the element has as many animations as it can take.
- The canvas marks the page being designed as current in its menus, as the website does, and the website now marks it in page designs too.
- An effect or animation on an element drawn more than once (each link of a menu) runs on every copy.

**Old menus:** a Menu without a Menu link draws exactly as before (same HTML, no CSS). The builder adds one when the page is opened without marking it changed; with nothing set it adds no CSS. Menu links can't be deleted, copied or moved on their own.

Judgement calls: the hover look lives in the Menu link's Content (one choice, plus colour and the current-page switch only for the looks that draw something), not as a new Style group. Kept "Keep it on the current page's link" beside the look, since the circle is a drawn look rather than a style; the Current look in Style still does the rest. The Header element still draws its own links (the Navigation sections use the Menu element). Lift stays the first (default) hover tile for text, so existing behaviour is unchanged.

Files: `packages/builder-model/src/menu-links/` (new, with README), `components/site-navigation-components.ts` (Menu link), `components/content-components.ts` (Menu holds it), `styles/compile-stylesheet.ts`, `data/bound-items.ts`; `packages/builder/src/render/elements/menu-link.tsx` (new), `render/stand-in-components.tsx`, `render/elements/navigation.tsx`, `render/page-effects.ts`, `menus/menu-link-panel.tsx` (new), `style-panel/StylePanel.tsx`, `panels/ContentPanel.tsx`, `panels/SelectedElementPanel.tsx`, `canvas/canvas-frame-script.ts`, `canvas/canvas-messages.ts`, `editor/commands.ts`, `editor/useBuilder.ts`, `PageBuilder.tsx`, `i18n/menu-strings.ts`; `packages/motion/src/effects/modules/text.module.ts` (roll up), `effects-catalogue/catalogue/text-effects.ts`, `effects/loadEffects.ts`, `runtime/mountMotionList.ts`, `module-sizes.ts`; `packages/motion-editor/src/motion-panel/*`; `packages/core/src/navigation/*`, `website/page-data.service.ts`, `website/site-chrome.service.ts`; `packages/site-components/src/site.types.ts`; `packages/admin/src/menus/builderMenus.ts`, `page-design/PageDesignPage.tsx`.

**Tests:**

- builder-model `menu-links/menu-links.test.ts` (11): Menu links in new menus and the navigation sections; added to older menus; ids; careful reading; old and untouched menus give no CSS; shared, Hovered and Current looks; one link's own look, ordered under the shared states; each hover look for hover, focus and the current page, and for less motion; not keeping it on the current page; the drawer's look; the scramble effect.
- builder `menus/menu-links.test.tsx` (9): old menus' exact HTML; links with class and `data-menu-item`; roll-up markup with the hidden copy; the scramble effect binding on every link, and no script otherwise; drawer links; delete, copy and move refused; the selection flow (click Contact on the canvas → Only “Contact” → change kept by id → Every → shared → Use the shared look); the note without a link in hand. `canvas/canvas-messages.test.ts` (+1). Browser `menu-link-looks.test.ts` (4): circle held on the current link, on hover and on keyboard focus; not kept; less motion (instant, no roll); roll up.
- motion browser `effects.browser.test.ts` "text on hover" (3): roll up on hover and focus on every link, read once; still for less motion; scramble on hover and focus, then the real words.
- motion-editor `MotionPanel.test.tsx` (+6): hover tiles for text, buttons, pictures and containers; a word effect added from its tile and swapped; effect tiles usable when animations are full.
- core `website.test.ts` (+1): a Menu's links with the Menu link's class, the menu item's id and the current page marked; `navigation.test.ts` delivers item ids; `site-sections.test.ts` expects the Menu link's class and id on the navigation's current link. admin `menus/builderMenus.test.ts` (1): the page being designed is marked current on the canvas.

**Screenshots** (`screenshots/text-hover/`): `after-builder-{light,dark}-1-hover-look`, `after-builder-{light,dark}-2-only-contact`, `after-site-desktop-current`, `after-site-desktop-hover-{1-mid,2-end}`, `after-site-390`, `after-site-390-drawer`.

**Runs:** builder-model 27 files / 313 tests; builder unit 46 / 377, browser 12 / 39; motion unit 19 / 156, browser 4 / 69; motion-editor 9 / 63 and browser 2 / 7; site-components 10 / 44; admin 144 / 770; core 193 files / 1,309 passed, 6 skipped (the one failure in the full run, `site-sections.test.ts`, was the navigation's link gaining its Menu link's class; updated and passing).

## Follow-up fixes (3 November 2026)

Screenshots are in `screenshots/follow-ups/`.

**LINTEL-UX-081: Atelier's making scene with less motion or no scripts.** The held scene's three steps sit in a row three screens wide, which only works while the scroll animation holds the page and slides the row. With less motion asked for, or without scripts, nothing moved it, so only step 1 showed in a box that scrolled sideways. The stylesheet now adds rules for any held sideways scene (a pinned scroll animation that moves its panels along) under `@media (prefers-reduced-motion: reduce), (scripting: none)`: the row becomes a column and each panel takes the full width (`builder-model/src/styles/still-scenes.ts`). With motion allowed and scripts running, nothing changes. Test: builder-model `atelier.test.ts`, "stacks the making steps down the page when motion is reduced or scripts don't run". Screenshot: `fix1-steps-stacked-reduced-motion.png`.

**LINTEL-UX-082: entrances under the intro.** The site runtime started every animation as soon as the page loaded, so load and in-view entrances played underneath the intro. The intro module now fires `lintel:intro-end` on the document when it has lifted, or when it removes itself without showing (seen this visit, or less motion). The site runtime starts entrances (`load` and `inView`) after that event, or after 4.5 seconds at most. Everything else (scroll scenes, hovers, page exits) still starts at once. The wait is in the site runtime file (9.8 KB gzipped, under its 10 KB budget), not the core runtime, which is unchanged at 10,234 bytes. Test: motion `intro-entrances.browser.test.ts`, "wait until the intro has lifted, then play" and "play at once when the intro was seen already this visit". Screenshot: `fix2-headline-after-intro.png`.

**LINTEL-UX-083: slider peek on phones.** A slider with more than one slide now shows 88% of a slide at phone widths, so the edge of the next one shows. The Slider has a new advanced setting to switch this off, "Show the edge of the next slide on phones" (`phonePeek`, on by default). The testimonial slider is unchanged. Test: builder `elements.test.tsx`, "lets the next slide peek in on phones, unless switched off or there's only one". Screenshot (390px): `fix3-slider-peek-phone.png`.

**LINTEL-UX-084: slider buttons in the site's colours.** The arrows and the pause button now use the site's link colour for the icon and a border mixed from it. The link colour is the brand colour, adjusted where needed to reach 4.5:1 on the background. On hover they fill with the brand colour and use its matching readable text colour, and focus shows an outline in the link colour. Test: builder `elements.test.tsx`, "colours the slider's arrows from the site's own colours, not plain black and white". Screenshot: `fix4-slider-arrows.png`.

**LINTEL-UX-085: the intro counter's font.** The intro was set in the theme's heading font, but it shows before any font has loaded, so the count started in the device's own font and changed part way through. On a site whose Site styles give headings a different font, it never matched at all. The intro module now uses the font the page's headings really show, and keeps the count or name hidden until that font has loaded (600ms at most). A CSS fallback shows it after 0.8 seconds if the module never arrives. Test: motion `intro-entrances.browser.test.ts`, "shows the count in the font the site's headings use, once that font is ready". Screenshot: `fix5-intro-counter-heading-font.png`.

**LINTEL-UX-086: site styles' uses across the whole site.** The count came from the open page plus the site styles themselves, so uses on other pages were invisible. A new `GET /website/design/uses` endpoint counts each variable and shared style across the site's pages, its navigation and footer, and blocks. It reports both the number of uses and the number of pages (`countSiteDesignUses` in core; `countDesignUsesIn` and `addDesignUses` in builder-model). The builder adds these to its live count for the open page, so a row reads "12 uses", and the delete warning names the other pages ("…on 3 other pages. Those pages lose it; this page keeps how it looks now."). Tests: core `site-design.test.ts`, builder-model `site-design-uses.test.ts`, builder `site-styles.test.tsx` ("counts uses across the whole site, and names the other pages a delete changes"). Screenshot: `fix6-site-wide-uses.png`.

**LINTEL-UX-087: deleting a site font's file.** The media library's in-use check only looked at entries, so a font's files could be moved to the recycle bin while the site still used them. The usage check now also asks site fonts (`findSiteFontsUsingAsset`). The delete is refused with `ASSET_IN_USE`, and the dialog lists "Site fonts → Playfair Display" and says to remove the font in Site settings first. Uploaded font files are protected the same way. Tests: core `site-fonts.test.ts` ("won't let the media library delete a file a font is made of, and names the font"), admin `MediaLibraryPage.test.tsx` ("names the site font a downloaded font file belongs to when deleting is refused"). Screenshot: `fix7-font-file-in-use.png`.

**LINTEL-UX-088: command line tests on Windows.** The code resolves paths correctly with Node's `path` module, but the tests "reads paths from where the person ran the command" and "reads the same settings and defaults as the server" compared the results against Linux-only strings. They now build their expected paths with `path.resolve`, `path.join` and `path.sep`, so Windows gets drive letters and backslashes while Linux checks exactly what it did before. Command line tests: 36 of 36 pass on Windows.

## LINTEL-UX-080: content-only editing for clients (3 November 2026)

**Approved by Daniel:** agencies design the site in the builder, then give clients access that only lets them update content. Until now anyone who could edit a page could change its design.

**Now:**

- **A built-in role, Client (content only)**, given in Users like any other: sees, creates, edits and publishes content and uploads media. No design, blocks, code, settings, templates, plugins or people. Designing pages is a permission of its own, "Design pages" (`builder:design`); Owners, Admins, Editors and Authors have it, and custom roles that could edit content were given it by migration 0031, so nobody lost anything.
- **What clients can change**, in the builder's Content tab for any element, closed until opened: Words, Pictures, Links (only those the element has) or Nothing, and "Clients can add more of these" on lists and repeated items (cards, slides, a gallery's pictures). Without a choice: text gives words, pictures give pictures, buttons and links give words and links, layout and styling never. Stored on the element (`clientEdits`, `clientRepeats`); old pages need nothing.
- **The client's view.** A client opening a page's design gets "Editing content": the page as it looks, words typed in place, a click on a picture opens the media library, a panel with only the fields they may change, and Add another / Remove this one where allowed. No Insert, Layers, Style, Animate, site styles, code, section tools or dragging; the site's navigation and footer stay as they are. Undo and History work, and it has a four-step tour of its own.
- **The server enforces it.** A save from someone without "Design pages" is compared with the stored design; anything beyond allowed words, pictures, links and item copies or removals is refused with a plain message naming the element (403). The navigation, footer, site styles and blocks already need "Make and change the site's blocks".
- **Clients' changes** (Users → Roles): Go live when they publish, or Wait for approval. Waiting, a client's Publish becomes Send for review (in the builder and the entry editor), and Owners, Admins and Editors see "Waiting for review" on the dashboard and in the collection view's status filter, with Approve (publishes) and Send back (with a note the client sees).
- **The entry editor** is unchanged for clients, without the template choice.

Decision record: `docs/decisions/0053-content-only-editing-for-clients.md`. Migration `0031_client_reviews` (the `client_reviews` table, and `builder:design` for custom roles that could edit), checked on a fresh database (the tests) and on a copy of the styles test data.

**Tests:**

- builder-model `client-editing/client-editing.test.ts` (9): defaults per element; the designer's choice; the fields a client sees; new words, picture and link accepted; style, level, added and removed elements refused; words refused where the designer chose Nothing, and the setting itself; item copies and removals only where allowed, never all, never restyled or reordered; gallery pictures added only where allowed.
- core `client-editing/client-editing.test.ts` (11): the role's permissions, and that it's the only built-in role that edits without designing; a client's text and link change accepted; style, move, added element and heading level refused with the plain message; designers unaffected; repeat items; shared sections and site styles refused; publishing while changes go live; with approval, Publish and unpublish refused, Send for review, approve publishes (and clients can't approve), send back needs a note and leaves the live page alone.
- builder `client-editing/client-editing.test.tsx` (9): the client view without Insert, Layers, Style or Animate; only the allowed fields, and changing them; typing only where allowed; the "part of the design" note; Add another and Remove this one only where allowed; its own tour; only allowed words marked typeable on the canvas; the designer's choices and "Clients can add more of these"; old pages open unchanged for designers.
- admin `client-editing/clientEditing.test.tsx` (8) and `PageDesignPage.test.tsx` (+1): Send for review and Waiting; the sent-back note; approving and sending back from the widget, and no buttons for people who can't approve; the setting; the builder opening in Edit content with Send for review. One existing page design test now gives its designer "Design pages". In core, test people who design pages (blocks, pages, site sections, starter sites) were given "Design pages" too, the built-in role lists include the Client role, and the OpenAPI document lists `GET` and `POST /entries/{id}/review`.

**Checked in a browser** (Chromium, 1440px and 390px, light and dark, on a copy of the styles test data with the private reference pages unpublished and out of the menu; a client, Cleo, invited with the new role): the designer's controls; the client's tour, view, heading change (saved by the server), a design part, and Send for review; the dashboard widget (cropped to the widget, since the rest lists the reference pages) and the Roles screen with the setting. Approving the review from the API published the change.

**Fixed on the way:** at 390px the widget's date pushed the page's name out of its row, so the row shows the name and who sent it only; the builder's "Changes not live yet" note is left out for clients who send changes for review, so the top bar doesn't wrap.

**Screenshots** (in `screenshots/client-editing/`): `designer-what-clients-can-change-desktop-{light,dark}`, `client-tour-desktop-light`, `client-view-start-desktop-{light,dark}`, `client-view-heading-desktop-{light,dark}`, `client-view-design-part-desktop-{light,dark}`, `client-view-sent-for-review-desktop-light`, `dashboard-waiting-for-review-{desktop,390}-{light,dark}`, `roles-client-setting-{desktop,390}-{light,dark}`.

**Left for later:** the site's own blocks and code blocks are closed to clients (their properties and marked parts could be opened the same way); restoring an older revision isn't checked against the design; a client's new page starts empty until a designer lays it out.

## The add-on kit (3 November 2026)

**Asked by Daniel:** a full add-on kit, so developers can build the kinds of add-ons Statamic has for Lintel (field types, template tags, builder elements, widgets and screens, events and jobs, settings, commands), packaged as npm packages and installed into a site. No directory or marketplace for now.

**Where it started:** plugins (decision 0012) already had field types, builder blocks, routes, tables, settings and the admin's screens, widgets and field editors, but only from Lintel's source tree: the admin half was bundled at build time, so a release install couldn't add one, and one broken plugin stopped the server. The audit is in `docs/decisions/0052-the-add-on-kit.md`.

**What changed:**

- **New things a plugin can add** (`packages/core/src/plugins`): `liquid` tags and filters, typed `events` handlers, timed `jobs`, terminal `commands` (`lintel <id>:<name>`) and a field type's own `deliver()` for the API, GraphQL and templates. Each runs only while the plugin is on; a failing tag leaves a gap, not an error page. `@lintel/core/plugin` also exports the field helpers for block properties, `escapeHtml` and `packageFolder`.
- **Add-ons** (`packages/core/src/addons`): npm packages with a `lintel-addon` section in package.json (id, Lintel versions, built files), installed into `addons/` in the Lintel folder so they survive updates, roll backs and new Docker images. Each is loaded on its own at start; one that isn't installed, doesn't fit this version, fails to load or fails the checks is left out with a plain reason. The admin loads their admin halves at start against its own React and design system, so a release install works without rebuilding.
- **Build → Add-ons** (`packages/admin/src/addons`): each add-on with whether it is on; choosing one shows its switch, what it adds and can reach in plain words ("Runs inside your site with full access…"), a settings form drawn from its schema, and how to remove it. Add-ons that can't run are listed apart.
- **`lintel addons`** (`packages/cli`): `add`, `remove`, `list`, `link`, `unlink`, `build` (esbuild, leaving out what is shared with Lintel) and `new` (a working add-on with a field type and editor, a tag and filter, an element, a widget, an event handler, settings and tests).
- **Example** `packages/addon-example`: colour swatches and opening hours, one of each part.
- **Docs:** "Building add-ons", with Umbraco and Statamic comparisons, and `lintel addons` in the command line reference.

**Tests:** core `plugins/plugin-extensions.test.ts` (10), `addons/addons.test.ts` (18); cli `addons/addons.test.ts` (8, including making, building and loading a new add-on); admin `addons/*.test.ts*` (8) and the Build page's list; addon-example (10).

**Checked in a browser** (Chromium, desktop and 390px, light and dark; on a copy of the styles test data with the private reference pages unpublished and out of the menu, the example linked and one missing package listed): Build → Add-ons, an add-on's details with its settings form, and the example's own Opening hours screen loaded from its built bundle.

**Screenshots** (in `screenshots/addon-kit/`): `addons-list-{desktop,390}-{light,dark}`, `addon-details-{desktop,390}-{light,dark}`, `opening-hours-screen-{desktop,390}-{light,dark}`.

**Left for later:** rich text extensions (the editor's buttons and the HTML renderer are one fixed list; documented as next); an add-on's own tables aren't in backups yet (backups cover Lintel's schema; the same was already true of plugins from lintel.config.ts); Lintel's packages aren't on npm, so new add-ons link to a local copy of Lintel for types and tests.

## First-party add-ons (3 November 2026)

**Asked by Daniel:** Lintel's own add-ons, built with the add-on kit (decision 0052) to prove it and fill the shelf: newsletter sign-up for Mailchimp and Brevo, site search, redirects, an Instagram feed and extra field types (icon, colour palette, map location, table). Each one useful, privacy-respecting and installed with `lintel addons add`.

**Where it started:** core already had redirects (SEO tools: screen, 301/302, CSV import, applied by the website, suggested when a live page's address changes), a Search box element with a `/search` page that only read titles and summaries, a Newsletter element that kept sign-ups as form answers, and Icon, Table and Colour (with swatches) fields. Add-ons had no way to answer visitors from the website's own address. Decision record: `docs/decisions/0060-first-party-add-ons.md`.

| ID            | What                                                                                                                                                                                                                                                                             |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LINTEL-UX-170 | New add-on `@lintel/addon-newsletter`: Mailchimp or Brevo connection in Settings → Newsletter (key kept in its own table, only a hint shown), double opt-in on by default, a sign-up element and `{% newsletter_signup %}` with a consent tick box, all calls made by the server |
| LINTEL-UX-171 | New add-on `@lintel/addon-instagram`: paste a token on the Instagram screen; posts and pictures copied to the site's database hourly, token renewed daily, alt text per picture, a feed element and `{% instagram_feed %}`; visitors load nothing from Instagram                 |
| LINTEL-UX-172 | New add-on `@lintel/addon-extra-fields`: Map location (paste a map link, coordinates checked, OpenStreetMap only on request and behind the cookie notice on the site) and Colour palette (named colours with readable text colours), with Liquid filters and a Map element       |
| LINTEL-UX-173 | Add-ons couldn't answer visitors from the website's address: the website now passes `/_lintel/api/addons/*` to `/delivery/add-ons/*` (`ADDON_PUBLIC_PREFIX`), keeping an add-on's own cache header (a feed's pictures) and `no-store` otherwise                                  |
| LINTEL-UX-174 | Site search missed words in a page's body and design: `/search` now reads every word of a published page, skipping addresses and design settings, title matches first                                                                                                            |
| LINTEL-UX-175 | Liquid templates had no search box: `{% search_box %}` draws the Search box element's form (`label:`, `placeholder:`, `button:`)                                                                                                                                                 |
| LINTEL-UX-176 | Redirects: already complete in core, so no add-on was made (a second redirects list would compete with the first); recorded in decision 0060                                                                                                                                     |
| LINTEL-UX-177 | Found while checking: the newsletter add-on's form showed the browser's plain inputs on the published site. It now uses the site's own Newsletter element classes and button, so it matches the site in light and dark                                                           |
| LINTEL-UX-178 | Found while checking: the empty Instagram feed's line was squeezed into one grid column at 390px; it now spans the grid                                                                                                                                                          |
| LINTEL-UX-179 | Found while checking: sign-ups from the site's own Newsletter element went only to Forms. With the newsletter add-on connected, senders of the `newsletter` form are added to the list too (double opt-in still applies)                                                         |

**Tests:** addon-newsletter `newsletter.test.ts` (22), addon-instagram `instagram.test.ts` (13), addon-extra-fields `extra-fields.test.ts` and `shared.test.ts` (17); core `plugins/plugin-system.test.ts` (+1: visitors' routes through the website, switched off, cache headers), `liquid-templates/liquid-engine.test.ts` (+1: `{% search_box %}`), `website/designed-elements.test.ts` (+1: words in a page's design found, settings not).

**Installed and checked in a browser** (Chromium, 1280px and 390px, light and dark, on a copy of the styles test data with the private reference pages unpublished and out of the menu): each add-on packed with `pnpm pack` and installed with `lintel addons add <file>.tgz`, switched on at the next start; Build → Add-ons and each add-on's details; Settings → Newsletter and the Instagram screen (not connected: no real keys used); an entry with a Map location and a Colour palette; a published page with the sign-up form, the feed and the map (the form's inline script and the forwarded route answered; the cookie notice names OpenStreetMap).

**Screenshots** (in `screenshots/first-party-addons/`): `addons-list`, `newsletter-details`, `instagram-details`, `extra-fields-details`, `newsletter-screen`, `instagram-screen`, `extra-fields-editor`, `site-elements`, each `-{desktop,390}-{light,dark}`.

**Left for later:** an add-on's details dialog doesn't link to its own screen (Newsletter is under Settings, Instagram in the sidebar); add-on field types have no options panel in the content type editor yet; static publishing has no API beside it, so the sign-up form and feed can't reach the add-ons there; the connected Instagram and Newsletter states were checked by the tests only, as no real accounts were used.
