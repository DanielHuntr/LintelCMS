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
