# 32. Links to pages are stored by the page's id

Date: 2026-11-03

## Decision

"Choose a page…" (the rich text link form, Link fields and the builder's link inputs) stores
the page itself, not its address, as the string `lintel:page/<entry id>`. Wherever a link is
drawn, Lintel swaps it for the page's address at that moment.

- **Where it is stored:** in the place that already held the address. That is the `href` of a
  link in rich text, a Link field's `url`, and a builder element's link prop (`href`,
  `buttonHref`, each address in a list of links). No field changes shape and no migration
  is needed.
- **Where it is resolved:** in the delivery layer (`deliverValues`), which the built-in
  website, previews, Liquid templates, the REST delivery API and GraphQL all go through.
  Rich text gets the address in its HTML and in its JSON, with `entryId` beside it on the
  link mark. Link fields become `{ url, label, entryId }`. A page's design has every page
  link swapped for the address before it is drawn.
- **A page that is gone** (deleted, in the bin, or not live) leaves no link behind. In rich
  text the words stay as plain text. A Link field is delivered as `null`, as an image field
  whose image has gone is. A builder button or link keeps its words without an address.
  Where the link is edited, the admin says "This page no longer exists".
- **Typed addresses are untouched.** `/about` and `https://…` keep working as before, and old
  content is not converted.

## Why

- Menus already link to pages by id and work out the address when they are drawn, and
  people expect every other link to behave the same. A typed `/about` breaks when the page
  is renamed or moved in the tree.
- One string form fits every place an address already lives, so validation, storage, the
  editors and the delivery shape barely change. An `{ entryId }` object would have needed a
  new shape in rich text marks and builder props, and a migration for builder designs.
- `lintel:` is not a scheme browsers know, so a reference that escaped resolution could never
  lead anywhere unexpected. Core's own HTML renderer drops any link it doesn't allow.
- Resolving in the delivery layer means one piece of code covers the website, previews,
  Liquid and headless sites, and headless sites never see the internal form.

## Consequences

- Linking to a draft page shows the words without a link until the page is published, as
  menus leave out items for unpublished pages.
- Plugins or importers that write links can use `pageLinkHref(entryId)` from
  `@lintel/builder-model`; `readPageLinkId` reads one back.
- The builder's inline text links (the bar over selected words on the canvas) still take
  typed addresses only.
- The redirect Lintel offers when an address changes is still useful for links from outside
  the site, but links inside it no longer depend on it.
