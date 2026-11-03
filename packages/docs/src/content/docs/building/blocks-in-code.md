---
title: Blocks in code
description: Define the site's blocks as files with defineBlock, render them with an HTML template or a React component, sync them like the content model, and add them from plugins.
since: "0.6"
---

Blocks are a site's own reusable designs with properties editors fill in (see
[Make your own blocks](/using/your-own-blocks/) for the editor's side). Most are made in the
builder, but a developer can also define them as files, which are reviewed in pull
requests and deployed with your code like the rest of the
[content model](/building/content-model-as-code/).

## A block file

Blocks live in `content-model/blocks/`, one file each, named `<handle>.block.ts`:

```ts
// content-model/blocks/team_card.block.ts
import { defineBlock, image, text, toggle, url } from "@lintel/core/content-model";

export default defineBlock({
  name: "Team card",
  icon: "users",
  category: "Team",
  description: "A person, their role and a link to their profile.",
  properties: {
    name: text({ required: true }),
    photo: image({ helpText: "Square photos work best" }),
    role: text({ validation: { maxLength: 40 } }),
    show_linkedin: toggle({ default: true }),
    linkedin: url({
      conditions: { rules: [{ field: "show_linkedin", operator: "is", value: true }] },
    }),
  },
  render: `
    <article class="team-card">
      <img src="{{photo}}" alt="{{photo.alt}}">
      <h3>{{name}}</h3>
      {{#role}}<p>{{role}}</p>{{/role}}
      {{#show_linkedin}}<a href="{{linkedin}}">LinkedIn</a>{{/show_linkedin}}
    </article>`,
});
```

- The **handle** is the file's name (`team_card`) unless the definition sets `handle`.
- **Properties** use the same helpers as content types' fields, so they have the same types
  and settings: widths, conditions, validation, defaults, help text. Pages, blocks fields,
  fieldsets and tabs can't be properties.
- `icon` is a name from the site's icon set; `category` groups blocks in Insert.

### Templates

`render` as a string is an HTML template. Every value is escaped.

| Slot                      | Gives                                                             |
| ------------------------- | ----------------------------------------------------------------- |
| `{{name}}`                | The value: text, a picture's address, a link's address            |
| `{{photo.alt}}`           | A picture's description                                           |
| `{{link.label}}`          | A link's words                                                    |
| `{{#name}}…{{/name}}`     | Kept while a toggle is on or a value is filled in                 |
| `{{#people}}…{{/people}}` | Repeated for each row of a repeater; slots inside name its fields |
| `{{^name}}…{{/name}}`     | Kept while it isn't                                               |

Lintel checks templates when it reads the file: a section that isn't closed, or a slot that
isn't a property, is reported with the file's name.

### React components

`render` can also be a React component, in a `.block.tsx` file. The server draws it with
`{ properties }` (pictures as `{ src, alt, width, height }`, repeaters as arrays of rows) and
sends the HTML with the page, so the builder's canvas and the website show the same thing.
Use plain, semantic HTML and the theme's `--lintel-*` tokens, as the site's own components do.

```tsx
// content-model/blocks/quote.block.tsx
import { defineBlock, text } from "@lintel/core/content-model";
import type { QuoteBlockProperties } from "../../generated/lintel-content";

export default defineBlock<QuoteBlockProperties>({
  name: "Quote",
  properties: { words: text({ required: true }), who: text() },
  render: ({ properties }) => (
    <figure className="quote">
      <blockquote>{properties.words}</blockquote>
      {properties.who && <figcaption>{properties.who}</figcaption>}
    </figure>
  ),
});
```

`pnpm --filter @lintel/core model types` writes `<Name>BlockProperties` for every block, the
`properties` its component is given.

## Syncing

Block files are synced like the rest of the content model:

- `model diff` lists new, changed and removed blocks; `model push` applies them; production
  applies them when the server starts.
- Removing a block file while pages use it is a change that deletes content: it waits for a
  confirmation (`model push --allow-data-loss`, or the admin), like removing a field with
  values.
- In the admin, blocks from files say **Defined in code** and are read-only. Blocks made in
  the builder are content, never written to files.
- `model pull` writes template blocks back to files; a React block's file is yours and is
  left alone.

A content type in a file can offer a block in a blocks field:

```ts
sections: blocks({ blockTypes: { team_card: { block: "team_card" } } }),
```

The block type's name and fields come from the block's file.

## What the API gives you

- **Page designs** store each instance as `{ type: "customBlock", props: { block, values } }`.
  Values are checked against the block's properties whenever the page is saved.
- **Blocks fields** deliver site blocks as ordinary blocks, `{ id, type, data }`, with `data`
  expanded like any entry's (images, rich text), and GraphQL types them from the block's
  properties.
- `GET /blocks` lists every block with its properties; `GET /blocks/:handle` adds where it's
  used. See `packages/core/src/blocks/README.md` for the rest of the endpoints.

## Blocks from plugins

A plugin can add blocks with `definePlugin`'s `blocks`. Each handle starts with the plugin's
id (dashes as underscores); the blocks are offered while the plugin is switched on.

```ts
import { defineBlock, definePlugin } from "@lintel/core/plugin";
import { text } from "@lintel/core/content-model";

export default definePlugin({
  id: "bookings",
  name: "Bookings",
  description: "Appointments and the people who made them.",
  blocks: [
    defineBlock({
      handle: "bookings_book_now",
      name: "Book now",
      properties: { label: text({ default: "Book an appointment" }) },
      render: `<a class="lintel-button lintel-button--primary" href="/book">{{label}}</a>`,
    }),
  ],
});
```
