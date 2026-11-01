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
