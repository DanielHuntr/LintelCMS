# 38. Reusing styles: Site styles, variables everywhere, dark values, variants and tag styles

Date: 2026-11-03

## Context

Decision 35 gave the site named colours, sizes and fonts (design variables) and shared
styles. In use they were hard to find and to read: the variables were only shown with
nothing selected, closed sections said `#111111` or `var(--lintel-var-ink)` rather than a
name, "Shared style: None" was a bare dropdown, and a colour variable kept its one value in
dark mode. Website makers also had no way to set how every link or heading looks.

## Decision

### Site styles, in the right panel

How things look is in the right panel, so the site's styles are there too. A **Site styles**
row in Style (under the shared style) opens them over the element's Style, with Back; with
nothing selected, Style shows them. It lists Colours, Sizes and Fonts (each with a preview,
its value and how many times it's used), Shared styles and, later in this record, the looks
for every element of a kind. Rows are short and open one at a time to rename, change or
delete. Empty groups offer a few starting points ("Ink", "Paper", "Gutter").

Deleting something that's used asks first and says what happens. A deleted variable's value
is written out on this page's elements (a step in Undo) and in the site's shared styles, so
they look as they did. A deleted shared style detaches this page's elements, which keep the
look as their own. Pages not open can't be changed from here; the warning says so.

### Variables everywhere

Swatches, size chips, the font list and size boxes offer the site's own first, then the
theme's. Choosing one still stores `var(--lintel-var-…)`. A closed section says the
variable's name with a small dot ("Ink"), and a size box using one shows its name with
Unlink. A colour or size picked by hand can be saved as a variable from under the control.

When two elements around the selected one have the same name, "What has to be hovered" says
how far up each is ("Container, just around it", "Container, 2 levels up").

## Not done here

Usage counts cover this page and the site's shared styles, not every page: counting every
page would mean reading them all each time the panel opens.
