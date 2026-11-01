# Content

Where editors write: the collections overview, each collection's entries, and the entry editor.

## Screens

| Route                           | File                      | What it is                                 |
| ------------------------------- | ------------------------- | ------------------------------------------ |
| `/content`                      | `ContentOverviewPage.tsx` | A card per collection, with counts         |
| `/content/:collection`          | `EntriesListPage.tsx`     | Search, status filter, reorder, pagination |
| `/content/:collection/new`      | `EntryEditorPage.tsx`     | A new entry (`newEntryId` is `"new"`)      |
| `/content/:collection/:entryId` | `EntryEditorPage.tsx`     | The entry editor                           |

The routes are registered in `src/router.tsx`. The list keeps its filter in the URL
(`?status=draft&search=hello&page=2`), so a filtered list survives a reload.

## The entry editor

`EntryEditorPage` loads the collection and the entry (or, for a new one, its blueprint) and
hands over to `EntryEditor`, which lays out the document and the side panel. The rules live in
small files that tests call directly:

- `entryDraft.ts`: the editor's state as a reducer. `saved` is what the API last accepted and
  `current` is what is on screen; there are unsaved changes when they differ. It also decides
  when the slug follows the title (new entries, and drafts never published whose slug still
  matches their title).
- `useAutosave.ts`: saves about 1.5 seconds after typing stops, one save at a time.
  Cmd/Ctrl+S calls `saveNow`. A new entry is only created once it has a title.
- `useEntryActions.ts`: every call the editor makes (save, publish, unpublish, schedule,
  restore, delete) and what to refresh afterwards.
- `fieldErrors.ts`: the API's per-field messages (`fields` on a 400). Explicit saves and
  Publish move focus to the first field with a problem; autosave never moves focus.
- `useLeaveWarning.ts`: asks before leaving with unsaved changes (our dialog inside the admin,
  the browser's when closing the tab).

A new entry's address changes from `/new` to its id after the first save. The editor isn't
remounted when that happens (see `useEditorKey` in `EntryEditorPage.tsx`), so nothing typed
in the meantime is lost.

Each field is drawn by `src/fields`. The side panel (`EntrySidePanel.tsx`) holds status and
publishing, the parent page for tree collections, and the revision history with restore.

## Permissions

- `entries:create` shows "New entry"; `entries:update` allows reordering.
- `entries:publish` shows Publish, Unpublish and Schedule. Without it, the main button is Save.
- `entries:delete` shows Delete in the "More" menu.
- `blueprints:update` shows "New content type" on the overview.

The API checks every permission again; hiding buttons is about clarity, not security.

## Reordering

Tree and flat collections can be reordered by dragging (pointer) or with each row's up and
down buttons (keyboard and screen readers, with a spoken confirmation). Pages move with the
pages nested under them, and only among their siblings: a page changes parent in the editor.
`treeOrder.ts` holds those rules. Reordering is off while a search or filter is applied.
