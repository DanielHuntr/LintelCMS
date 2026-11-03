# Placed grid (canvas side)

`grid-fit.ts` works out where an element dragged on a placed grid lands: moving keeps its
spans and finds the nearest column and row lines, the corner handle keeps its start and finds
the nearest end, and "fit" reads where an element sits now (for the arrow keys). Rows past
the last one count at the grid's shortest row height, so things can be dropped under
everything else. It is self-contained so the canvas frame can be given it as text (see
`canvas/canvas-frame-script.ts`, which does the dragging, the column guides and the keys).

What a placed grid is, and how it becomes CSS, is in `@lintel/builder-model`'s
`placed-grid/` folder. `editor/design-commands.ts` switches it on and off and stores a place
at the screen size being edited; `style-panel/GridPlaceControls.tsx` shows the place as
"Columns 2 to 6", with the exact values folded away.
