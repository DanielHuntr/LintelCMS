# UX pass, batch 3 (2 Nov 2026)

A hands-on pass through the admin and the website as a first-time, non-technical owner, on `release/1.0.0-rc` at `f6fa1da`. Chromium (Playwright), 1440x900 and 390x844, light and dark mode, with a fresh data folder set up through the wizard as an "Online shop". Findings already in `UX-IMPROVEMENTS.md`, `VISUAL-REVIEW.md`, `BUG-REPORT.md` or the fix logs are left out.

Screenshots are in `screenshots/batch-3-ux/`. `-dl` means desktop light, `-dd` desktop dark, `-ml` mobile light.

Each finding is marked **[S]** small fix or **[R]** redesign. Redesigns wait for Daniel's approval.

## Verdict

The wording, empty states and guidance are well above average. The weak spots are where features meet: content editor and builder, forms and email, shop and website. Each screen looks finished on its own, but an owner can follow every instruction and still end up with a site that quietly doesn't work.

The five that hurt a non-technical owner most:

1. **Two ways to write a page, and one gets hidden** (LINTEL-UX-006). Body text vanishes from the website once a design exists; the editor still shows it, with no warning.
2. **Form notifications never arrive** (LINTEL-UX-007). "Email me about new submissions" is on by default; with no mail service nothing is sent and nothing says so.
3. **New products show "Sold out"** (LINTEL-UX-008). Stock counting starts on with 0; the admin list shows a green "On sale" badge.
4. **The shop looks open before it can sell** (LINTEL-UX-009). With no delivery prices, the shopper fills in the whole checkout and is then told "We can't deliver to that address yet". The website has no Shop link.
5. **The builder misleads at key moments.** Escape throws away typed text (LINTEL-UX-010); Publish gives no confirmation (LINTEL-UX-011); a chosen form still says "Choose a form"; style controls don't show the element's real look.

## Findings

### Setup and dashboard

- **P3 [S]** `/setup` review: the required "I've checked these details" box is below the fold at 1440x900, and the disabled Finish button only has a small hint. Drop the box, or put it next to Finish. (`08-setup-review.png`)
- **P2 [S]** The success screen says "Built-in database" (jargon), has no link to the website, and offers templates as a small text link right after the owner chose a kind of site. Add "See your website" and a "Start from a template" button filtered to their choice. (`09-after-setup.png`)
- **P2 [S]** No "View website" link anywhere (LINTEL-UX-012). The address is only in Settings → Your website. Add "View site" under the site name in the sidebar. (`10-dashboard-dl.png`)

### Content and page editor

- **P1 [R]** LINTEL-UX-006, `/content/pages/:id`: Body and Design both show in the editor. After a section is added in the builder, the Body text disappears from the website but still shows in Body, and the builder says "This page is empty" although Body has text. Once a design exists, collapse Body behind "Not shown on your site (this page uses a design)", or start the design from the Body. (`16-builder-open.png`, `28-content-editor-after-design.png`, `26-live-home-after-design-dl.png`)
- **P2 [S]** The create dialog asks "What would you like to make?" with a single choice, "Pages" (plural, the type's name). Skip the picker when there is one choice, and use singular names. (`12-create-home.png`)
- **P3 [S]** The home page shows "Home" as a huge heading on the website. Hide the title on the home page by default. (`15-live-home.png`)
- **P3 [S]** "Taxonomies", "Global settings" (next to Settings) and "Hostnames…" are jargon for clients: "Categories and tags", "Site-wide text", "Web address…".
- **P3 [S]** "Moved to the recycle bin" has no Undo, and deleting a page that a menu links to doesn't say so; the menu then shows "Deleted page". (`94-menu-ml.png`)

### Builder

- **P1 [S]** LINTEL-UX-010: Escape while editing text discards the edit; clicking elsewhere keeps it. Escape should keep it.
- **P2 [S]** LINTEL-UX-011: Publish shows no confirmation and the button doesn't change. "Saved" doesn't say the changes aren't live; the page editor says "changes not yet published", the builder never does. (`27-publish-feedback-150.png`, `29-builder-unpublished-change.png`)
- **P2 [S]** The Form element still says "Choose a form in the Content panel." after Contact is chosen, although the website shows the form. Draw the form, or name it. (`64-builder-form-chosen.png`)
- **P2 [S]** The Contact form section doesn't pick the only form there is, and opens on Style instead of Content. (`62-builder-contact-section.png`)
- **P2 [S]** The Hero's button links to `/contact`, a 404 on a new site. Default to `#`, or ask for the link. (`21-builder-button-content.png`)
- **P2 [R]** Beginner Style panel: controls don't show the element's real look (centred text shows "Left"; a large heading shows no size); "Layout: Stack/Row/Grid/Normal", "Grow with the screen" and px fields appear in Beginner mode; colour swatches have no names and three are near-white. (`20b-builder-heading-editing.png`, `19-builder-hero-added.png`)
- **P2 [S]** The Insert list has tiny abstract thumbnails; the helpful descriptions only show on hover. (`18-builder-intro-list.png`)
- **P2 [S]** LINTEL-UX-013: at 390px the builder spills about 640px wide, the canvas can't be seen, and the tour still runs. Show "The designer needs a bigger screen" with a Preview link. (`93-builder-ml.png`)
- **P3 [S]** The Layers tree's expand buttons have empty accessible names.

### Forms

- **P1 [S]** LINTEL-UX-007: notifications are on by default; with no mail service nothing is sent, and neither the form's Settings tab nor anything else says so. The message only reaches Settings → Email outbox. Settings has no screen to set up email. Warn inline: "Email isn't set up, so you won't be emailed. Check Submissions." Invitations already handle this well. (`60-form-settings.png`, `70-email-outbox-dl.png`)
- **P2 [S]** "Add to your site → On a page" is instructions only. Add "Add to a page…", which picks a page and inserts the section. (`59-form-add-to-site.png`)
- **P2 [S]** Nothing points the owner to new enquiries: no dashboard widget, no unread count on Forms. (`69-forms-list-dl.png`)
- **P2 [S]** The form editor scrolls sideways at 390px (about 607px). (`96-form-edit-ml.png`)
- **P3 [S]** After sending, the website form still looks filled in, with a grey thank-you box above the button. Replace the form with the message. (`67-live-form-sent.png`)
- **P3 [S]** Copy: "1 submission, the last now" should read "latest just now"; "a field's handle" is jargon.

### Shop

- **P1 [S]** LINTEL-UX-008: new products count stock from 0 and show "Sold out"; the admin list shows "On sale" beside "0 in stock". Don't count stock by default, or ask for a quantity, and show "Sold out" in the admin. (`79-product-page-ml.png`, `78-shop-dl.png`, `80-products-list.png`)
- **P1 [R]** LINTEL-UX-009: no "ready" state. Without delivery prices or payments, products look buyable and checkout fails at the end; the website has no Shop link. Keep the shop "coming soon" until the Shop checklist is done, and offer to add Shop to the menu. (`86-checkout-after-delivery.png`, `78-shop-dl.png`)
- **P2 [S]** "Add product" leads through a gate page, a Markets page and a dialog: three "choose where you sell" steps. The dialog has the currency set but no countries; its name box shows a placeholder that looks filled in; "Market" is merchant jargon; validation uses the browser's bubble. Preselect the country that matches the currency. (`71-product-new.png`, `73-market-dialog.png`)
- **P3 [S]** The product editor has no "View on site", Save only at the top of a long form, a "Linen shirt" placeholder on a bakery, and a duplicate name silently becomes `sourdough-loaf-2`. (`77-product-saved.png`)
- **P2 [S]** At 390px the basket drawer cuts "Remove" to "Remo". (`83-basket-ml.png`)

### Settings, people and branding

- **P2 [S]** The Settings list puts the Site group (Your website, Features, Sites) last, under API access, Webhooks and Security. Move it to the top. (`36-settings-dl.png`)
- **P2 [R]** Three places for "how it looks", each with a logo and colour: Design, Settings → Your website and Settings → Branding (the admin's own look). The website's default colour is Lintel's purple; fonts are listed by name with no preview. (`46-site-dl.png`, `39-branding-dl.png`, `43-design-dl.png`)
- **P3 [S]** The first site is called "Default site", not the name given in setup. (`40-sites-dl.png`)
- **P3 [S]** Inviting says "We've emailed…" even with no mail service (the link fallback that follows is good), and "It's just you so far" still shows while an invitation is pending. (`88-invite-sent.png`)

### Mobile and keyboard

- **P2 [S]** At 390px the content tree sits above every Content screen, so the menu editor is a long scroll down; collapse it behind a button. Menu row actions only show on hover. (`94-menu-ml.png`)
- **P3 [S]** On the home page form, the sticky header covers the field browser validation scrolls to (same cause as LINTEL-A11Y-006).
- Focus rings are clear in both themes, and dark mode is consistent.

## Keep these

1. Plain-English microcopy throughout: "Leave without saving?", "Only if you'd like a call back", the alt-text guidance, "Prices include tax: usual in the UK…".
2. The setup wizard: free-moving steps, inline checks, "Suggest a password".
3. The Shop checklist ("4 left to do") and the Templates gallery.
4. Invitations that show a link to copy when email may not arrive: the pattern for form notifications.
5. The recycle bin, and menus that link to pages so they keep working when an address changes.
