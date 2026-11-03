# Custom blocks

A site's own blocks: a design with properties editors fill in, such as a Team card with a
Name, a Photo, a Role and a "Show LinkedIn" toggle. The reasoning is in
docs/decisions/0027-custom-blocks.md; the server side is `packages/core/src/blocks`.

| File                    | What it holds                                                                |
| ----------------------- | ---------------------------------------------------------------------------- |
| `custom-block.ts`       | `CustomBlock`, the `customBlock` element instances are, values and renames   |
| `block-bindings.ts`     | What bindings mean inside a block's design, and values as a bound item       |
| `expand-blocks.ts`      | `expandBlockInstances` (drawing instances as their design) and detaching one |
| `block-template.ts`     | HTML templates with `{{property}}` slots, for blocks written in code         |
| `make-block.ts`         | "Make into a block": the parts that could be properties, and the block made  |
| `component-variants.ts` | Variants: their looks, drawing an instance's variant, keeping designer edits |
| `similar-elements.ts`   | "Make these one component": similar elements, and what differs between them  |

## How an instance is drawn

A page stores an instance as one element, `{ type: "customBlock", props: { block, values } }`.
Before a page is drawn, `expandBlockInstances` gives each instance a copy of its block's
design with the values put where the properties are bound, using the same `bindings` and
`bindProps` collection lists use. Then the renderer draws the tree as usual. Because the design
is read from the block each time, changing the block changes every page that uses it.

Empty values leave the design's own words and pictures in place, so a new instance looks
exactly like the block did when it was made.

Inside a block's design, bindings point at properties:

| Binding                                | Property type      | What it does                            |
| -------------------------------------- | ------------------ | --------------------------------------- |
| a prop: `text`, `src`, `href`…         | text, image, link… | fills the prop                          |
| `visible`                              | toggle             | shows the element only while it is on   |
| `style.color` (and background, border) | colour             | sets that colour, if it is a safe value |
| `items`                                | repeater           | repeats the children once per row       |

Values are kept by property handle. When a property is renamed, the block remembers the old
handle in `renamedProperties`, and `currentValues` reads older instances under the new name.

## Components and variants

In the builder these are called components (docs/decisions/0059-components-with-variants.md).
A component can have variants (`variants` on the block: Size, Style, Icon...). Its design is
the look with every variant at its default; each other look is a `VariantLook`, the differences
for some variant values (`{ when: { size: "small" }, elements: { <id>: { styles, props, hidden } } }`).
`designForVariant` lays the matching looks over the design, least specific first, before the
design is expanded, so the canvas, the website and Detach all show the chosen variant. An
instance stores only the choices that differ from the defaults (`props.variant`).

`recordVariantEdit` keeps a designer's edit made while a variant is shown: new and moved
elements go into the design (every variant has them), and the rest becomes that variant's
look; an element deleted there is hidden in that variant instead.

Animations, effects and owner states inside the design are pointed at each instance's own
copies when it is expanded, so animating the component's title animates every instance's title.
