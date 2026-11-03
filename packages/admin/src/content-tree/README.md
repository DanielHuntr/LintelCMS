# Content tree

The Content section's frame: a persistent tree beside the main navigation, and the
workspace (`src/content-workspace`) beside it. Opening something changes the address but
not the frame, so the tree keeps its place, links can be shared, and Back works. The API
is `packages/core/src/content-tree` and `packages/core/src/recycle-bin`.

## Screens

| Route                  | File                 | What it is                                                                                 |
| ---------------------- | -------------------- | ------------------------------------------------------------------------------------------ |
| (layout)               | `ContentSection.tsx` | The resizable tree pane and the workspace                                                  |
| `/content/recycle-bin` | `RecycleBinPage.tsx` | Restore, delete for good, empty the bin; deleted files under Files (`RecycleBinFiles.tsx`) |

## The tree

- **Sections**: one per collection allowed at the top (page trees first), then "Site-wide"
  (Global settings, Menus, Taxonomies, each a folder) and the Recycle bin at the bottom.
  With more than one site there is a site switcher at the top.
- **Rows** (`TreeRow.tsx`) show an icon per content type (`typeIcons.ts`), the name and a
  status dot (`StatusDot.tsx`): solid green published, amber ringed green published with
  newer changes, hollow draft, accent-coloured scheduled. Rows also say the state to screen readers.
- **Loading**: a branch loads only when opened, 100 rows at a time with "Show more"
  (`TreeBranch.tsx`). Collections and entries whose children are listed in the workspace
  (`childrenAsCollection`) show a count instead of opening.
- **Remembered**: open branches (per site) and the pane's width are kept in this browser
  (`treeState.ts`). Opening an entry from a link opens the branches above it.
- **Filter**: typing at the top searches every title in the site and lists the matches.
- **Keyboard**: the ARIA tree pattern. Up and Down move, Right opens (or goes in), Left
  closes (or goes to the parent), Enter opens the workspace, Shift+F10 or the menu key
  opens the row's actions. The pane's edge is a separator: arrow keys resize it.

## Actions

The "…" button, a right-click or Shift+F10 opens a row's menu (`TreeActionsMenu.tsx`);
`treeActions.ts` decides what it offers from the person's permissions and the row.

| Action                 | What happens                                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Create…                | `CreateDialog`: only the content types allowed there, then a name                                                          |
| Duplicate…             | Optionally with everything under it; opens the copy                                                                        |
| Move…                  | `MoveDialog`: find a page, or the top of its section (undo offered)                                                        |
| Sort children…         | `SortDialog`: up and down buttons, or A to Z, saved together                                                               |
| Publish… Unpublish…    | Optionally with everything under it; reports what wasn't ready                                                             |
| Preview, History, Info | Open that part of the workspace                                                                                            |
| View page              | The live page on the website, or Lintel's own view of it                                                                   |
| Delete…                | To the recycle bin, with everything under it; the note offers Undo (`useRecycleWithUndo.ts`), which puts it back as it was |
| Hostnames…             | `HostnamesDialog`: a domain and/or path for a page at the top                                                              |

**Creating at the top**: the "+" beside Content, a right-click on empty space, or Create on
a section offers only content types allowed at the top. Pages at the top are site starts
(the first is "/", see `packages/core/src/content-roots`); until there is one, the tree
shows "Create your home page".

Dropping a page on its own section puts it at the top. When a move changes live pages'
addresses, the note offers "Add redirects…" (`RedirectsDialog`) beside Undo, for people who
can change settings while the SEO tools are on.

Dragging a row onto another puts it before, inside or after it, by where it lands
(`dropPosition`, `moveForDrop`); a note at the bottom of the tree offers Undo. The server
checks every move against the content types' rules.

## Files

| File                     | What it does                                              |
| ------------------------ | --------------------------------------------------------- |
| `contentTree.api.ts`     | One function per API route                                |
| `contentTree.queries.ts` | Cache keys and hooks; `useRefreshContent` after changes   |
| `ContentTreeContext.tsx` | What the tree's parts share                               |
| `selectedTreeKey.ts`     | Which row the address selects                             |
| `testTree.tsx`           | Test helpers for screens that expect the tree around them |
| `RenameDialog.tsx`       | "Rename…": the entry's title; its address stays           |

Choosing the site's pages (the first page tree) unfolds it and its home page. "Move…" lists
the tree's top level and the pages under each before anything is typed (`useMoveTargets`).
"Create…" asks what to make only when more than one content type may go there; with one, the
title names it ("New page in Home"). The recycle bin shows where each item was and the first
pages that were under it, so two items with the same title can be told apart.
