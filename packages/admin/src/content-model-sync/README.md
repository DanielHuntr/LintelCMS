# Content model sync

The admin's side of content model as code (the API's is in
`packages/core/src/content-model-sync`). When a site keeps its content types, taxonomies,
global sets and menus in files:

- `useContentModelStatus()` reads `GET /content-model/status`; `useContentModelEditable()`
  is false while editing is switched off here. Screens that change the model (content
  types, taxonomies, global fields, menu settings) hide those controls; content stays
  editable.
- `ManagedInCodeBanner` sits at the top of those screens: "Managed in code" when locked,
  "Saved to code too" on a developer's computer, nothing when the site isn't managed in code.
- `ModelSyncNotices` on the content types screen lists changes from the files that wait
  for a confirmation (each with what it would delete, and "Make these changes" behind a
  confirmation), problems reading the files, and notices such as a change here being
  undone because the file changed at the same time.
- `useContentModelEvents()` (in `AdminLayout`) listens to `GET /content-model/events` and
  reloads everything that shows the model when it changes, so a developer saving a file
  updates open screens.

Words are in `src/i18n/contentModelSyncStrings.ts`, used through `t()`.
