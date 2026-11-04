# Components

Every element the builder can place on a page, described once. `defineComponent`
(`component-definition.ts`) says what an element is called, which props it has, what can be
edited and where it may go. `component-catalogue.ts` gathers them into one list, and
`component-props.ts` has the props many elements share.

The other files are the elements themselves, by family: `layout-*`, `content-*`, `media-*`,
`form-*`, `block-*`, `collection-*`, `shop-*`, `creative-*`, `effect-*`, `info-*`,
`site-navigation-*`, and the single `clock-`, `code-block-` and `model-component.ts`.

These are descriptions, with no drawing in them, so the server can check a saved page against
the same list the builder uses. `packages/builder` adds the drawing half. A new element
goes in its family's file and in the catalogue.
