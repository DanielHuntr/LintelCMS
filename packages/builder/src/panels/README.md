# Panels

The builder's side panels: Layers and Insert on the left, the selected element's Style,
Content, Animate and Code on the right (`SelectedElementPanel`).

## Insert

`InsertPanel` is a library with a search at the top and two segments, **Sections**
(ready-made sections drawn as sketches, the default) and **Elements** (single pieces as a
two-column grid of icon tiles). Each segment is grouped by kind, with only the first group
open at first; what's left open, the segment and the recently used items are remembered
(see `preferences/`). The search looks through both at once.

`InsertTile` is one item: press it to insert, drag it into Layers to place it. Its
description isn't in the list: it's the tile's accessible description, a hover card (also
shown on keyboard focus) and the ⓘ details popover, which closes with Escape and puts focus
back. `insert-library.ts` holds the plain logic: the items, groups, search and the recent
list.

## Content

`ContentPanel` shows an element's fields. Elements with more than three, in more than one
kind, show them in collapsible groups (Words, Link, Picture, Options; see
`content-groups.ts`), each saying what's filled in while closed.

The element library's Content fields: `field-controls.tsx` draws any simple field (numbers,
dates, icons, pictures kept with their description, a choice of the site's collections or
forms), `item-list-field.tsx` lists of items with fields of their own (slides, plans, people)
and the **Shows** picker that binds a prop to a field of the current entry. `data-sources.ts`
holds what the app says the site has (`BuilderDataSources`) and finds the list or item page
an element is in; `canvas-data.ts` turns it into sample data for the canvas.

## The site's blocks

Insert lists the site's own blocks first under "Your site's blocks", and a selected instance
shows its property form instead of these tabs. See `../blocks/README.md`.
