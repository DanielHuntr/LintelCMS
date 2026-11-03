# 35. Editorial layouts: placed grids, shared styles and the site's own variables

Date: 2026-11-03

## Decision

Website makers get the layout freedom of editorial sites (a picture across columns 2 to 6
with its text in 8 to 11, a heading over the corner of a photo, a different layout on phones)
without a cluttered designer. Three additions do it, each built on something that was
already there.

### Placed grids

A section, box or container can now place what's inside it in one of three ways: **in
order** (as before), **on a grid** (new), or **anywhere** (the existing free layout). On a
grid, elements are dragged onto equal columns. While one is dragged the columns show and the
cells it would take are shaded. The corner handle changes how many columns and rows it
spans, and the arrow keys move it a column or a row (with Shift they resize it).

- **Stored as plain styles.** The node gets `placedGrid: { columns, stackOnPhone }`. Each
  element's place is its ordinary `gridColumn` and `gridRow` (`2 / span 5`), set at the
  screen size being edited and cascading like any other style. The published page is plain
  CSS grid.
- **The setting implies the rest**, under the element's own styles (as free layouts do):
  equal columns, rows at least 3rem tall so empty rows can take a drop, the whole width for
  elements not placed yet and, with `stackOnPhone`, one under another on phones for elements
  without a phone place of their own.
- **Overlap is allowed**, with stacking by z-index, reusing the free layout's stacking
  buttons. The order in Layers stays the reading order.
- **One or the other.** A container has a free layout or a placed grid, never both.
  Switching one on takes the other off in the same step in Undo.
- **Simple in the panel.** The place shows as "Columns [2] to [6]" and "Rows [1] to [2]".
  The CSS values are folded under "Exact values".

`gridAutoRows` joins the list of style properties. The page document's version doesn't
change: older pages have no `placedGrid` and draw exactly as before.

### Shared styles

A look can be saved under a name ("Card") and used by other elements across the site. An
element that uses one stores only `sharedStyle: "card"`. When a page is drawn, the shared
look goes **under** the element's own styles, so:

- changing the shared style changes every element that uses it, on every page;
- "Only this one" in the Style panel keeps a change on the element, over the shared look;
- Detach gives the element the look as its own.

A shared style holds how things look, never where they are. Places on a grid or in a free
layout, and stacking, stay on each element.

**Resolved when drawn, not as a CSS class.** `applySharedStyles` merges the shared look into
each element before the stylesheet is written, as custom blocks are expanded. The
stylesheet, class names and canvas don't change. The cost is repeated declarations in the
CSS when many elements share a look. That is small next to the risk of a second cascade
(shared class against element class) that people would have to understand.

### Design variables

The site can have its own named colours, sizes and fonts ("Sand", "Wide gutter",
"Display"). Each is a custom property, `--lintel-var-sand`, written at the end of the site's
stylesheet. A style that uses one stores `var(--lintel-var-sand)`, as the theme's tokens
already work. Swatches, font choices and spacing chips offer them after the theme's own, and
a colour picked by hand can be saved as one. The theme's tokens are unchanged. Values are
checked by kind (a colour must look like a colour), and nothing that could end a declaration
is accepted.

### Where they live

Variables and shared styles are one `siteDesign` row in the settings table, read and saved
with `GET` and `PUT /website/design`. No migration is needed. Changing them changes every
page, as a block does, so it needs `builder:blocks` (whose description now says so). Anyone
who can design a page can use them. The admin saves half a second after the last change, as
it does for site motion. Changes to the site's design aren't steps in the page's Undo;
making, using and detaching a shared style on an element are.

## Not done here

Canvas zoom and pan, side-by-side screen sizes and a right-click menu (from the same
mock-up) come separately. Variables don't yet change with a dark colour scheme.
