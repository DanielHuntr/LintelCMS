# Lintel 1.0.0-rc.1: shop and data fix log

Fixing pass, 2 Nov 2026, branch `fix/qa-shop` from `qa/discovery`. Defect details are in [BUG-REPORT.md](BUG-REPORT.md).

**Environment:**

- Linux; Chromium headless (Playwright, one worker);
- dev servers: API :4740, site :3740, admin :5740; data folder `/tmp/fix-shop-data`;
- built-in database; shop enabled at setup;
- seeded like the discovery pass: market GB/GBP, zone UK with Standard £4.95 (2 to 3 working days), product `linen-shirt` (M £45, L £50, no picture), discount `SAVE10` (10% off everything).

Screenshots are in [screenshots/fix-shop/](screenshots/fix-shop/). "Before" screenshots were taken on the unfixed code in the same environment.

## LINTEL-DATA-001: Backups store media files as 0 bytes

**Status:** Verified.

**Root cause (confirmed):**

- `ZipArchiveWriter.addStream` counted bytes with a `'data'` listener on a `PassThrough`. A `'data'` listener switches the stream to flowing mode, so chunks were hashed and then dropped whenever they arrived before yazl piped the entry.
- It is a race, not a constant failure. yazl only pipes an entry once the entries before it are written, so whether it attaches before the first chunk depends on timing.
- On the unfixed code, 2 of 11 backups in this environment had 0-byte media (one with one image empty, one with both), and their restore preview answered `400 BACKUP_DAMAGED`. The existing test `backup archives > says what a restore would replace…` also failed with `BackupDamagedError` on the first run.
- `content-export.service.ts` calls the same `addStream`, so content exports with files had the same race.

**Change:**

- `packages/core/src/archives/zip-writer.ts`: count and hash in a `Transform` that passes every chunk on, so the stream stays paused until yazl reads it. Nothing else changed.

**Tests:**

- New `packages/core/src/archives/zip-writer.test.ts`: writes a 200 KB file stream and a small in-memory stream, reads the archive back, and checks the bytes, the size and the SHA-256. It fails on the unfixed code ("expected false to be true") and passes with the fix.
- `packages/core/src/content-transfer/content-transfer.test.ts`: the export/import test now checks the imported picture has the same bytes, not only that it answers 200.
- `src/archives`, `src/backups` and `src/content-transfer` tests: 16 passed.

**Runtime verification (fixed code, server restarted):**

- Two PNGs uploaded (7,831 and 270,388 bytes), plus 40 filler pages so the database entries take longer to write.
- 12 backups in a row: every zip has `media/default/….png` at 7,831 and 270,388 bytes, and every restore preview answers 200.
- Round trip: backup, download, restore preview (200), delete one picture, restore (200), sign in again; both pictures are served with SHA-256 identical to the originals.
- `GET /content-export?files=true`: both media entries at their full size.

**Screenshots:** none; the fix has no visual part.

## LINTEL-FUNC-001: Closed basket drawer rendered over shop pages

**Status:** Verified.

**Root cause (confirmed):**

- `:where(.lintel-cart) { display: flex }` in `element-stylesheet.ts` is an author style, so it beats the browser's `dialog:not([open]) { display: none }`. The closed `<dialog class="lintel-drawer … lintel-cart">` was drawn on top of the page.
- The keyboard focus problem has the same cause: a closed dialog that is displayed keeps its close button and checkout link in the Tab order. Before the fix, 4 of 25 Tab presses on the product page landed inside the closed drawer.

**Change:**

- `packages/builder/src/render/elements/element-stylesheet.ts`: the rule now applies to `.lintel-cart:not(dialog)` (the basket page) and `.lintel-cart[open]` (the open drawer), mirroring `.lintel-drawer[open]`. Nothing else changed.

**Tests:**

- New browser test `packages/builder/src/browser-tests/shop-cart-drawer.test.ts` (real Chromium, real renderer and stylesheet), at 1440 and 390px: the closed drawer is `display: none` with no width, 8 Tab presses never reach it, the basket page keeps `display: flex`, and the drawer is `flex` once opened. It fails on the unfixed stylesheet (`display: 'flex', width: 384`) and passes with the fix.

**Runtime verification (`/products/linen-shirt`, desktop and 390px, light and dark):**

|                                    | Before                                                 | After                            |
| ---------------------------------- | ------------------------------------------------------ | -------------------------------- |
| Closed drawer                      | `display: flex`, 384×900 at x=1056 (343 wide at 390px) | `display: none`, 0×0             |
| Tab stops inside the closed drawer | 4 of 25                                                | 0 of 25                          |
| Click "Add to basket"              | times out (covered)                                    | adds; drawer opens with the line |

**Screenshots:**

- Before: [desktop light](screenshots/fix-shop/func-001-product-before-desktop-light.png), [desktop dark](screenshots/fix-shop/func-001-product-before-desktop-dark.png), [390 light](screenshots/fix-shop/func-001-product-before-390-light.png), [390 dark](screenshots/fix-shop/func-001-product-before-390-dark.png).
- After: [desktop light](screenshots/fix-shop/func-001-product-after-desktop-light.png), [desktop dark](screenshots/fix-shop/func-001-product-after-desktop-dark.png), [390 light](screenshots/fix-shop/func-001-product-after-390-light.png), [390 dark](screenshots/fix-shop/func-001-product-after-390-dark.png).
- Drawer opened by Add to basket: [desktop light](screenshots/fix-shop/func-001-drawer-open-after-desktop-light.png), [390 dark](screenshots/fix-shop/func-001-drawer-open-after-390-dark.png).

**Noticed, not fixed (new):** in the open drawer the "Check out" link is brand-coloured text on a brand-coloured button, so it reads as an empty purple bar. The site stylesheet's `a { color: var(--lintel-color-link) }` outranks the zero-specificity `:where(.lintel-button)`. It affects any `<a class="lintel-button">` on the website, so it is left for a separate decision.
