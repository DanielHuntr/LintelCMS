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
