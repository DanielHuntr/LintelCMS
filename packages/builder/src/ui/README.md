# UI

The small controls the builder's panels are made of (`controls.tsx`), using the admin's design
tokens so the builder follows light and dark mode and rebranding.

`CollapsibleSection` is the disclosure every long panel uses: a heading that is a button with
`aria-expanded`, a summary while closed, and content that isn't drawn while closed. A panel
that provides `OpenSectionsContext` turns its `PanelSection`s into these.
