# Menus

The site's navigation menus, under Content at `/content/navigation` (the API calls them
navigations: `packages/core/src/navigation`).

| Route                         | File                 |
| ----------------------------- | -------------------- |
| `/content/navigation`         | `MenusPage.tsx`      |
| `/content/navigation/:handle` | `MenuEditorPage.tsx` |

## The editor

`MenuEditor.tsx` shows the menu as one indented list. Every move can be made two ways:

- **Drag** a row by its handle (dnd-kit). A dropped item keeps its level where it can, but
  never goes deeper than one level below the row now above it.
- **Buttons** on each row, for the keyboard and screen readers: up and down among its
  siblings, out of its group, into the row above (only within the menu's levels), remove.
  Each move is announced in a live region ("“Blog” is now item 3 of 5, on level 2").

The tree rules are plain functions in `menuTree.ts` (with tests): the editor keeps the menu
flat, each item with its depth, and `buildMenu` turns it back into the tree the API stores.
Changes are saved together with Save; the API's problems come back per item and are shown
on the row.

"Add link" and choosing a row open `MenuItemSheet.tsx`: a page (chosen with
`EntryPickerDialog`, so the link follows the page if its address changes) or a typed web
address, a label (optional for pages: the page's title is used), and "Open in a new tab".
A link to a page that has since been deleted says so on its row.
