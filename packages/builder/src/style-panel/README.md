# Style panel

How the selected element looks. Simple shows a few friendly choices; Advanced (Designer and
Developer) shows every property, and **Style for** (a dropdown) styles the pointer-over and
keyboard-focus states.

Each group (Arrange, Layout, Spacing, Size, Text, Background, Corners and borders, Move and
turn, Shape and mask, Position, Effects, Blend and filters) is a collapsible section (`ui/CollapsibleSection.tsx`). Closed, it says what's set
inside, such as "Row · gap M" (`style-summaries.ts`). A site variable is said by its name
("Ink"), with a small dot for "linked" (`summary-names.ts`). Simple opens Layout, Spacing and Text
the first time and then remembers; Advanced opens only the group used last. A locked
element's groups still open, with their controls disabled.

`style-field.ts` connects controls to the element's styles at the chosen screen size or
state; `StyleInputs.tsx` has the controls themselves.

## Advanced styling

| File                                    | What it does                                                            |
| --------------------------------------- | ----------------------------------------------------------------------- |
| `ArrangeSection.tsx`                    | Free layout on a section, place and stacking inside one, grid placement |
| `TransformSection.tsx`                  | Turn and size (Simple); move, slant, turning point (Advanced)           |
| `ShapeSection.tsx`, `PolygonEditor.tsx` | Ready-made shapes, a polygon with draggable corners, masks              |
| `BackgroundSection.tsx`                 | Background colour, picture layers with focal points, gradients          |
| `GradientEditor.tsx`                    | A gradient's direction and colours                                      |
| `BackgroundVideoControls.tsx`           | A muted looping video behind a section, with poster and overlay         |
| `FiltersSection.tsx`                    | Ready-made looks; blend modes, filters and frosted glass                |
| `FontPicker.tsx`                        | Theme fonts, the page's fonts, bundled fonts and uploads                |
| `TextEffects.tsx`                       | Size that grows with the screen, outlines, shadows, vertical text       |
| `FocalPointPicker.tsx`                  | Click or arrow keys to choose the part of a picture to keep             |

Settings that aren't styles (free layout, the video, the page's fonts, stacking) reach the
controls through `design-tools.ts`, which the Style panel provides.

## The site's styles in every control

Colour swatches, size chips, the font list and size boxes offer the site's own named colours,
sizes and fonts first, then the theme's. A size box using one shows its name with Unlink;
a colour or size picked by hand can be saved as one ("Save as a colour", "Save as a size").
"Site styles" under the shared style opens the whole list (`site-design/SiteStylesPanel.tsx`).
