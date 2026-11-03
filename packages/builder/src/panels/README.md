# Panels

The builder's side panels: Layers and Insert on the left, the selected element's Style,
Content, Animate and Code on the right (`SelectedElementPanel`).

## Insert

`InsertPanel` is a library with a search at the top and two segments, **Sections**
(ready-made sections as compact rows with a small sketch, the default) and **Elements**
(single pieces as rows of icon tiles). Sections are grouped by purpose (Navigation,
Intro and banners, ... Footer), every group closed at first with its count; elements
by kind, with the first group open. What's left open, the segment and the recently used items
are remembered (see `preferences/`). The search looks through both at once, including each
section's keywords, so "bakery" finds Opening times. Sections that need a plugin (the shop's,
a form's) are only offered while it's on. `focusRequest` opens a segment with the search
focused: the empty page's **Add a section** and **Add elements** use it.

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
forms), `file-field.tsx` a file from the media library (the Lottie and Rive elements'
animation: uploaded, or by address), `item-list-field.tsx` lists of items with fields of their own (slides, plans, people)
and the **Shows** picker that binds a prop to a field of the current entry. `data-sources.ts`
holds what the app says the site has (`BuilderDataSources`) and finds the list or item page
an element is in; `canvas-data.ts` turns it into sample data for the canvas.

Link fields (and each address in a list of links) offer **Choose a page…** when the app
gives `PageBuilder` a `pickPage` (`page-picker.ts`, read through context rather than passed
down every panel). It stores the page itself, `lintel:page/<id>` (`pageLinkHref` from
builder-model), so the link follows the page when its address changes; the website swaps it
for the address when the page is drawn. In a list of links it fills in the words too when
there are none. With a `findPage` from the app as well, the input shows the page's title
instead of an address, or "This page no longer exists" when it has gone, with **Type an
address instead** to go back to typing one.

## The site's blocks

Insert lists the site's own blocks first under "Your site's blocks", and a selected instance
shows its property form instead of these tabs. See `../blocks/README.md`.

## Several selected

Ctrl/Cmd-click adds a layer or takes it away, Shift-click selects a range among siblings,
Ctrl/Cmd+A in Layers selects everything beside the focused layer and Shift with the arrows
extends; on the canvas, Shift-click (or Ctrl/Cmd-click) adds or takes away. Every selected
element is outlined, with one label ("3 selected"). Layers says `aria-multiselectable` and
each row's `aria-selected`.

`MultiSelectionPanel` replaces the element's panel: Style changes go to all of them (values
they don't share show as Mixed, through `StyleEditing.mixed`), Animate puts the same motion on
all, Content asks to select one, and the actions are Make these one component, a shared
style, Duplicate, Group into a box, Move up and down together, and Delete. Each is one step in
Undo (`editor/multi-selection.ts`). Delete, Duplicate and Alt+arrows act on all of them too.
The client's content-only view selects one element at a time.
