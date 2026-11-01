# Text marks

Styles on part of a heading's or paragraph's text: an italic letter inside an upright word,
an outlined word, a highlight. Stored as `marks` next to the text, as non-overlapping
character ranges with a few typographic styles each.

`text-marks.ts` applies and clears styles on a range, works out which styles a selection
shares (for the toolbar's pressed buttons), moves marks when the text is edited, and plans
how marks are drawn: italics as `<em>`, the rest as `<span>`, with a class
(`.title-mark-1`) in the page's stylesheet for anything more.
