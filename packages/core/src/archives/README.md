# Archives

Reading and writing `.zip` files for backups, exports and the WordPress importer, and
saving uploads of them to disk.

- `zip-writer.ts` streams files into a zip and returns each one's size and SHA-256 for a
  manifest.
- `zip-reader.ts` reads entries by name. Nothing is ever unpacked under a name from the
  archive, so a name like `../../etc/passwd` is only a key in a map. `ArchiveLimits` caps
  how much one file and the whole archive may unpack to.
- `uploaded-archive.ts` saves the file in a multipart upload straight to disk, without
  holding it in memory.

Errors (`archives.errors.ts`) are named and say what is wrong with the file in plain
words.
