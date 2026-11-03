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

### Light and dark values for colours

A colour variable can have a second value for dark mode (`darkValue`, optional, so older
designs read as before). It's written as `--lintel-var-paper: light-dark(#faf7f2, #17191c)`.
`light-dark()` follows the `color-scheme` the theme's stylesheet already sets on `:root`:
`light dark` for an automatic theme (the visitor's own setting), `light` or `dark` for a
fixed one. So a variable follows the scheme exactly as the theme's own colours do, with no
second copy of the theme's rules. Browsers without `light-dark()` get the light value from an
`@supports not` block. In Site styles, "Add a dark-mode colour" offers a starting value (the
light one's brightness turned round), and "Use the same colour in dark mode" takes it off.

### The shared-style row, and variants

The bare "Shared style: None" dropdown is now one row at the top of Style. Without a shared
style it says "No shared style · Save this look to reuse it" and opens to "Save this look…"
or a list of the site's. With one it names it with a small preview ("Button · 1 on this
page"), says where changes go ("Every Button" or "Only this one", as before) and offers
Rename, Make a variant and Detach.

**Variants** are shared styles with `variantOf` naming their base: "Outline" of "Button".
A variant starts empty and takes its base's look under its own, so changing Button changes
Outline too, and it overrides only what's different. One level only. `sharedStylesById`
resolves variants, so pages, the canvas and the website draw them with no other change, and
designs saved before have no `variantOf` and read as they did. With variants, the row shows
"Main · Outline" to switch between them; switching keeps what's set on the element. Deleting
a base turns its variants into shared styles of their own with the look they had.

In Site styles, shared styles list their variants under them, and **Select them** selects
the first element on this page that uses one and outlines the others on the canvas.

## Not done here

Usage counts cover this page and the site's shared styles, not every page: counting every
page would mean reading them all each time the panel opens.
