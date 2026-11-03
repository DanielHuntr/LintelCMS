# Content

Where editors write: the collections overview, each collection's entries, and the entry editor.

## Screens

The Content section is now the content tree and its workspace (`src/content-tree` and
`src/content-workspace`). This folder keeps the entry editor's building blocks, which the
workspace uses, and two screens:

| Route                                | File                    | What it is                              |
| ------------------------------------ | ----------------------- | --------------------------------------- |
| `/content/:collection/new`           | `EntryEditorPage.tsx`   | A new entry, for links from elsewhere   |
| `/content/:collection/:entryId/view` | `PublishedPageView.tsx` | Simple preview of the published version |

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

Each field is drawn by `src/fields`. A `page` field shows a summary and **Edit design**, which
opens the visual builder full screen (`src/page-design`). The side panel (`EntrySidePanel.tsx`) holds status and
publishing, the parent page for tree collections, and the revision history with restore.

Preview (in the toolbar and the More menu) opens a split view: the document on the left and
the page as the site renders it on the right (`src/preview`), in place of the side panel. It
uses the page's full width; otherwise the writing column stays about 720px and the side panel
grows with the window (`editorLayout.ts`).
"Duplicate entry" in the More menu saves first, then makes a draft copy after the original
(`POST /entries/:id/duplicate`) and opens it.

## View page

Published entries get **View page** in the editor's toolbar, an icon after the address under
the title, and an icon on their row in the list. `viewPage.ts` decides where it goes: with a
website address (typed in Settings → Your website, or else the built-in website's own, from
`GET /website/address`) it opens the page there in a new tab, built as the website serves it
(`website/pageAddress.ts`); with neither it opens `PublishedPageView`, which draws the
published version from `/delivery` with the built-in preview renderer under a banner about
connecting a site. Drafts have no View page.

## Permissions

- `entries:create` shows "New entry"; `entries:update` allows reordering.
- `entries:publish` shows Publish, Unpublish and Schedule. Without it, the main button is Save.
- `entries:delete` shows Delete in the "More" menu (to the recycle bin, then a note at the foot of the window with Undo, which reopens the entry); `entries:create` shows "Duplicate entry".
- `blueprints:update` shows "New content type" on the overview.

The API checks every permission again; hiding buttons is about clarity, not security.

## Reordering

Pages are moved and sorted in the content tree (dragging, "Move…" and "Sort children…").
`treeOrder.ts` still holds the rules the parent picker uses.
