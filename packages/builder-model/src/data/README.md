# Page data and bound elements

`bound-items.ts` describes what a page can show besides what is typed into it: the entries a
collection list repeats its item design for (`BoundItem`), the shop's products
(`ShopProduct`), forms, and the site's menu and languages (`DataSite`), together as
`PageData`. The website loads it for each page (`packages/core/src/website/page-data.service.ts`)
and the builder passes samples to its canvas.

An element shows a field of the current entry through its node's `bindings`:
`{ "text": "title" }` fills the `text` prop with the entry's title. `bindProps` applies them;
`bindableKinds` says which kinds of field a Content panel field can show. Every entry has the
fields in `entryFields`; a collection's own fields are `data.<handle>`.
