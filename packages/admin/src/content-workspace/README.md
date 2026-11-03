# Content workspace

What opens beside the content tree (`src/content-tree`).

| Route                           | File                      | What it is                                      |
| ------------------------------- | ------------------------- | ----------------------------------------------- |
| `/content`                      | `ContentLanding.tsx`      | Create, your recent edits, drafts, scheduled    |
| `/content/:collection`          | `CollectionWorkspace.tsx` | The collection as a list                        |
| `/content/:collection/:entryId` | `EntryWorkspacePage.tsx`  | An entry's workspace (`?tab=`, `?preview=true`) |

## An entry's workspace

An entry opens in the entry editor (`src/content`), and a page's Content and Design views
share one top bar (`src/page-home`). What follows is how its parts behave:

- **Header** (`WorkspaceHeader.tsx`): breadcrumbs from the section down, the name as an
  inline-editable heading, the address, status badges and the actions menu.
- **Tabs** (`workspaceTabs.ts`, `WorkspaceTabList.tsx`): Content (the blueprint's fields),
  Items (when its children are listed here), Settings (translations and plugin panels such
  as SEO), History (restore an earlier version) and Info (`InfoTab.tsx`: address, content
  type, people, dates, what links here, the id). The tab is in the address.
- **Footer** (`WorkspaceFooter.tsx`): saving state, Preview, View page, Save (keeps a
  version) and "Save and publish" with Schedule… and Unpublish in its menu.
- **Publishing under an unpublished parent** (`PublishWithParentDialog.tsx`): when a page
  that isn't live sits under pages that aren't either (`unpublishedAncestors` in the entry's
  info), "Save and publish" asks first: publish it with its parent (the pages above go live
  first, through the bulk publish), publish this page only, or cancel.
- Leaving with unsaved changes asks first (`useLeaveWarning`), including opening another
  row in the tree.

Blueprints don't group fields into tabs yet. When they do, those groups take the Content
tab's place in `visibleWorkspaceTabs`; field widths and conditions are `EntryFields`'s.

## The collection view

`CollectionView.tsx`: a table or a grid of a place's entries (a collection's top level, or
an entry's children), with the content type's `listColumns` as columns
(`columnValues.ts` turns values into short text), search, a status filter, sorting by any
column, pages of 25, and bulk Publish, Unpublish, Move… and Delete… (`BulkActionBar.tsx`).
On a collection's own page the search, filter, sort and page are in the address.

## The landing

`ContentLanding.tsx` draws the home dashboard's widgets (`core:my-edits`,
`core:needs-attention`, `core:scheduled`, see `src/dashboard`) and a Create button that
offers every content type allowed at the top.
