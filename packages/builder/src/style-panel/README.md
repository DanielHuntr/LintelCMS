# Style panel

How the selected element looks. Simple shows a few friendly choices; Advanced (Designer and
Developer) shows every property, and **Style for** (a dropdown) styles the pointer-over and
keyboard-focus states.

Each group (Layout, Spacing, Size, Text, Background, Corners and borders, Position,
Effects) is a collapsible section (`ui/CollapsibleSection.tsx`). Closed, it says what's set
inside, such as "Row · gap M" (`style-summaries.ts`). Simple opens Layout, Spacing and Text
the first time and then remembers; Advanced opens only the group used last. A locked
element's groups still open, with their controls disabled.

`style-field.ts` connects controls to the element's styles at the chosen screen size or
state; `StyleInputs.tsx` has the controls themselves.
