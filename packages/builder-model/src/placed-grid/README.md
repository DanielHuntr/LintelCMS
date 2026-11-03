# Placed grid

A section (or box, or container) laid out on equal columns, magazine style, with each
element placed on them by hand: a photo across columns 2 to 6, its caption in 8 to 11, a
heading running over the corner of the picture. On phones everything can go back to one
under another, unless an element is given a phone place of its own.

- `placed-grid.ts`: the `placedGrid` setting (`{ columns, stackOnPhone }`), the styles it
  implies (the grid itself, a full width for elements not placed yet, and the stacking on
  phones), and places: `gridPlaceStyles` writes `grid-column: 2 / span 5`, `readGridLine`
  reads the usual ways of writing one back, and `clampGridPlace` keeps a place on the grid.

Places are ordinary `gridColumn` and `gridRow` styles, so they change per screen size like
anything else and the published page is plain CSS grid. Overlapping elements are stacked
with z-index (`free-layout/z-order.ts`); the order in Layers stays the reading order. A
container has a free layout or a placed grid, never both. The canvas side (dragging onto
columns, the corner handle, arrow keys) is in `@lintel/builder`'s `placed-grid/` folder; the
reasoning is in docs/decisions/0035-editorial-layouts.md.
