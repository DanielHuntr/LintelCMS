# Menus

The site's navigation menus, under Content at `/content/navigation` (the API calls them
navigations: `packages/core/src/navigation`).

| Route                         | File                 |
| ----------------------------- | -------------------- |
| `/content/navigation`         | `MenusPage.tsx`      |
| `/content/navigation/:handle` | `MenuEditorPage.tsx` |

## How a menu is made

At the top, **How this menu is made**: "I arrange it" (the items below, by hand) or "Follow
the page tree" (the home page, then the pages under it in the tree's order, their children
as drop-downs, as deep as the menu's levels). Following the tree, each page can be hidden or
renamed there (`PageTreeMenuList.tsx`), and hidden pages are listed to show again. Switching
asks first; going back to arranging it keeps the pages it shows, and the hand-made items are
kept while it follows the tree. A **preview** (`MenuPreview.tsx`) shows how it looks, with
pages not yet published faded.

The editing state and saving are in `useMenuDraft.ts`, shared with the page builder, whose
Header, Menu and Menu drawer edit the same menu in place (`InlineMenuEditor.tsx`).

## On the page itself

"In the main menu" is a switch in Create (on for pages right under the home page, off for
deeper ones) and in a page's Settings tab with a menu label (`PageMenuSection.tsx`). It uses
`/navigation/main/pages/:entryId`, so it changes the same main menu as this screen, on the
site being edited.

## The editor

`MenuEditor.tsx` shows the menu as one indented list. Every move can be made two ways:

- **Drag** a row by its handle (dnd-kit). A dropped item keeps its level where it can, but
  never goes deeper than one level below the row now above it. Dragging to the right puts it
  inside the item above (a drop-down), to the left takes it out (`shiftDepth`).
- **Buttons** on each row, for the keyboard and screen readers: up and down among its
  siblings, out of its group, into the row above (only within the menu's levels), remove.
  Each move is announced in a live region ("“Blog” is now item 3 of 5, on level 2").

The tree rules are plain functions in `menuTree.ts` (with tests): the editor keeps the menu
flat, each item with its depth, and `buildMenu` turns it back into the tree the API stores.
Changes are saved together with Save; the API's problems come back per item and are shown
on the row.

"Add pages" (`AddPagesDialog.tsx`) lists the site's pages as an indented tree with a box
beside each: tick several and they are added at once, a page under its parent's item when
the parent is in the menu (`addPageItems`). Pages already in the menu are ticked already.

"Add link" and choosing a row open `MenuItemSheet.tsx`: a page (chosen with
`EntryPickerDialog`, so the link follows the page if its address changes) or a typed web
address, a label (optional for pages: the page's title is used), "Open in a new tab", and
"Show as a button" for a call to action such as "Book now".
A link to a page that has since been deleted says so on its row.
