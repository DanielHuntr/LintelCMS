# Compare with live

When a published entry has saved changes the website doesn't show yet, the entry editor's
Status section says "Unpublished changes" and offers **Compare with live**. It opens a
dialog listing every field that differs from the live version, in the content type's order.

- **Text** (text, textarea, Markdown, slug, email, address, code, and rich text read as its
  words) shows the words removed and added, inline, so it works the same on a phone.
  Changes aren't marked by colour alone: removed words are struck through and added ones
  underlined, each on a tint, and screen readers hear "removed:" and "added:" before them
  and "end of removed" and "end of added" after. A sentence above the list explains the marks.
- **Pictures** show the live and the new picture side by side, with their names.
- **Page designs** say "Design changed", with **View the live page**.
- **Simple values** (choices, switches, dates, numbers, links) show "Live" and "After
  publishing".
- **Anything else** (blocks, repeaters, lists of entries), and values of fields no longer in
  the content type, say "This changed".

It compares the values in the editor (so a change still waiting for autosave counts, and
the dialog says so) with `publishedData`, read from `GET /entries/:id/live`. The words are
compared in the browser (`textDiff.ts`); a very long text that changed is shown as removed
and added whole, so the browser never stalls.

| File                        | What it does                               |
| --------------------------- | ------------------------------------------ |
| `CompareWithLiveDialog.tsx` | The dialog                                 |
| `fieldChanges.ts`           | Which fields changed, and how to show each |
| `textDiff.ts`               | Words removed and added between two texts  |
| `liveVersion.api.ts`        | `GET /entries/:id/live`                    |
| `compareLiveStrings.ts`     | Its words, spread into `i18n/strings.ts`   |
