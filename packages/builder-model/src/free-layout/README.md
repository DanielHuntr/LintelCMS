# Free layout

A section (or box, or container) whose elements can be placed anywhere in it, overlapping
if wanted, for poster-like designs: giant words with a photo between them, a sticker over
a picture.

- `free-layout.ts`: the `freeLayout` setting (`{ stackOnPhone }`), the styles it implies
  (the section is `position: relative`, its children `position: absolute`, and on phones,
  with stacking on, back to one under another), and `freePlaceStyles` for a dragged place.
- `z-order.ts`: bring forward, send back, to front and to back, by `z-index` only.

Places are ordinary styles (`left`, `top`, `width` in %), so they change per screen size
like anything else. The order in Layers stays the reading order. The canvas side (dragging,
snapping, guides, nudging) is in `@lintel/builder`'s `free-layout/` folder.
