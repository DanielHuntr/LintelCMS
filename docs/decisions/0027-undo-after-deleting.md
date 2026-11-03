# 27. Undo after deleting, and a recycle bin for media

Date: 2026-11-03

## Decision

Deleting a page, an entry or a file says so in a short note with **Undo**: "Moved “About”
to the recycle bin. Undo". It applies to the content tree (one page or several), the entry
editor and the media library.

- **Undo puts things back as they were.** `POST /recycle-bin/:id/restore` takes
  `asBefore: true`: the entry goes back to its old place among its siblings, and, for
  someone with `entries:publish`, what was live is live again showing what it showed. The
  bin now keeps each entry's status and published copy so it can. Restoring from the
  recycle bin screen, later, still brings back drafts at the end of the list, as decision
  23 says: by then the site may have moved on, and publishing again is a choice.
- **The entry editor's Delete now uses the recycle bin**, like the tree. It used to delete
  for good, and said "This can’t be undone".
- **Media has a recycle bin.** `DELETE /media/:id` keeps the file's row in `binned_assets`
  and its bytes in storage. Undo, or Restore on the recycle bin screen (a Files group),
  brings it back with the same id; deleting it there, or emptying the bin, removes the
  bytes. Forms still delete their uploads for good.

## Why

- People delete the wrong thing. A question before every delete is easy to click through;
  Undo straight after is what actually saves them, and it's what every app they use does.
- Undo that unpublished the page, or moved it to the end of the menu, wouldn't be an undo.
- Files were the one thing that couldn't come back. Only unused files can be deleted, so
  keeping them in a bin can't leave anything pointing at them.

## Consequences

- Binned files still take space until the bin is emptied. They aren't in backups, and
  moving media to a bucket only copies the library's files, so a file binned before either
  can't be restored afterwards; the bin says so in plain words.
- The tree's Recycle bin count is still the number of binned entries, not files.
