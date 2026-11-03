# Menus in the builder

The Header, Menu and Menu drawer can show one of the site's menus (Content → Menus) instead
of links of their own (`menuSource: "site"`, `menuHandle`). With one selected, the Content
tab starts with **Which menu** and **Edit menu** (`menu-editing.tsx`). Edit menu shows the
app's own menu editor in the panel (`PageBuilder`'s `menuEditor`), so changes go to the same
menu the Menus screen edits; the builder never saves menus itself.

On the canvas, a site menu with nothing in it is drawn as a small **Add pages to your menu**
button (`EmptyMenuButton` in `render/elements/navigation.tsx`). The canvas frame reports a
press as `openMenu`, which selects the element and opens the editor. On the website an
empty menu draws nothing.

The menus' links reach the canvas through `dataSources.menus` (see `canvas-data.ts`);
without them it shows a sample menu. On narrow screens the Header folds its menu into a
menu drawer by itself (the stylesheet's tablet rule).

## Menu links

Every Menu holds one **Menu link** (see `menu-links/` in the model): the look of every link
in it, selected in Layers or by clicking a link on the canvas. Its Content sets what a link
does on hover (a line drawing in, the words rolling up, the letters scrambling, a circle, a
colour fade). Clicking a link reports it with the selection (`menuItem` on the frame's
`select` message); while it is in hand, Style asks **Changes apply to: Every menu link /
Only “Contact”** (`menu-link-panel.tsx`), and Only keeps the change on the Menu link by menu
item id. Menu links are part of their Menu: they aren't deleted, copied or moved on their
own. Menus made before Menu links get one when the page is opened in the builder.
