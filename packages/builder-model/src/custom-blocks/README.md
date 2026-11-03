# Custom blocks

A site's own blocks: a design with properties editors fill in, such as a Team card with a
Name, a Photo, a Role and a "Show LinkedIn" toggle. The reasoning is in
docs/decisions/0027-custom-blocks.md; the server side is `packages/core/src/blocks`.

| File                | What it holds                                                                |
| ------------------- | ---------------------------------------------------------------------------- |
| `custom-block.ts`   | `CustomBlock`, the `customBlock` element instances are, values and renames   |
| `block-bindings.ts` | What bindings mean inside a block's design, and values as a bound item       |
| `expand-blocks.ts`  | `expandBlockInstances` (drawing instances as their design) and detaching one |
| `block-template.ts` | HTML templates with `{{property}}` slots, for blocks written in code         |
| `make-block.ts`     | "Make into a block": the parts that could be properties, and the block made  |

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
