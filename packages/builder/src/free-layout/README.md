# Free layout (canvas side)

`snapping.ts` works out where a dragged element lands in a free layout: near the section's
edges or middle, or lined up with another element's edges or middle, it snaps there and
says which guide lines to draw. It is self-contained so the canvas frame can be given it as
text (see `canvas/canvas-frame-script.ts`, which does the dragging, nudging and guides).

What a free layout is, and how it becomes CSS, is in `@lintel/builder-model`'s
`free-layout/` folder. `editor/design-commands.ts` stores a dragged place at the screen size
being edited, and switches free layout on and off.
