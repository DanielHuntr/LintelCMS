---
title: Content model as code
description: Keep content types, taxonomies, global sets and menus as files in your repository, synced with the admin, deployed with your code and typed in your website.
since: "0.3"
---

Lintel can keep its **content model** (content types and their fields, the collections
that use them, taxonomies, global sets and menus) as files in your repository. The files
are the source of truth: they're reviewed in pull requests, deployed with your code, and
turned into TypeScript types for your website. In development the admin stays a perfectly
good way to build them, because everything you change there is written back to the files.

Content (entries, terms, global values, menu items) always stays in the database.

## Start

Make the folder from what your database has now. With Lintel stopped (the built-in
database can only be open in one program; with Postgres there's no need):

```bash
pnpm --filter @lintel/core model pull
```

That writes one file per content type, taxonomy, global set and menu:

```text
content-model/
  content-types/page.ts
  content-types/post.ts
  taxonomies/categories.ts
  taxonomies/tags.ts
  globals/site_settings.ts
  menus/main.ts
```

Commit the folder. From now on Lintel uses it whenever it exists.

## Writing a content type

```ts
// content-model/content-types/recipe.ts
import {
  defineContentType,
  image,
  number,
  richText,
  select,
  terms,
  text,
} from "@lintel/core/content-model";

export default defineContentType({
  handle: "recipe",
  name: "Recipe",
  collection: { handle: "recipes", name: "Recipes", structure: "flat", route: "/recipes/{slug}" },
  fields: {
    title: text(),
    photo: image({ required: true }),
    cooking_time: number({ helpText: "In minutes", min: 1 }),
    difficulty: select({
      choices: [
        { value: "easy", label: "Easy" },
        { value: "hard", label: "Hard" },
      ],
    }),
    method: richText({ required: true }),
    cuisines: terms({ taxonomy: "cuisines", maxItems: 2 }),
  },
});
```

- **Fields are keyed by handle**, in the order editors see them. The first must be
  `title: text()`.
- **Labels default to the handle in words** (`cooking_time` is "Cooking time"); set
  `label` to say something else.
- There's a helper for every fieldtype: `text`, `textarea`, `richText`, `number`,
  `toggle`, `select`, `date`, `image`, `link`, `email`, `url`, `colour`, `markdown`,
  `list`, `entries`, `terms` and `blocks`. Each takes exactly the options the blueprint
  builder offers, with JSDoc, so VS Code completes them and flags mistakes as you type.
- `collection` can be a list, if several collections share the fields. Leave `route` out
  for `/<handle>/{slug}`, or set it to `null` for entries with no page of their own.
- Where entries go in the admin's content tree is part of the collection too:
  `allowedAtRoot: false` for a kind that only lives under another page,
  `allowedChildren: ["pages", "landing_pages"]` for what may be created under one (a tree
  allows its own kind when left out), `childrenAsCollection: true` to list a long run of
  children beside the tree instead of in it, and `listColumns: ["price", "sku"]` for the
  fields that list shows as columns.

```ts
collection: {
  handle: "pages",
  name: "Pages",
  structure: "tree",
  route: "/{slug}",
  allowedChildren: ["pages", "landing_pages"],
},
```

A page builder is a `blocks` field with its block types keyed by handle:

```ts
sections: blocks({
  blockTypes: {
    hero: {
      description: "A big heading at the top of the page.",
      fields: { heading: text({ required: true }), image: image() },
    },
    quote: { fields: { text: textarea({ required: true }), author: text() } },
  },
}),
```

The other kinds:

```ts
export default defineTaxonomy({ handle: "cuisines", name: "Cuisines" });
export default defineGlobalSet({ handle: "opening_hours", name: "Opening hours", fields: { ... } });
export default defineMenu({ handle: "footer", name: "Footer links", maxDepth: 1 });
```

A file without a default export is a helper, so shared fields can live in their own file
and be spread in (`fields: { title: text(), ...seoFields }`).

### YAML instead

If you'd rather not write TypeScript, every file can be YAML with the same keys plus
`kind`:

```yaml
# yaml-language-server: $schema=../lintel.schema.json
kind: contentType
handle: recipe
name: Recipe
collection: { handle: recipes, name: Recipes, structure: flat }
fields:
  title: { type: text }
  cooking_time: { type: number, helpText: In minutes, min: 1 }
```

Pull in YAML with `model pull --format yaml` (or set `CONTENT_MODEL_FORMAT=yaml`), which
also writes `content-model/lintel.schema.json`. With the YAML extension for VS Code, the
first line of each file is enough for completion and checking; to set it up for the whole
folder instead, add this to `.vscode/settings.json`:

```json
{ "yaml.schemas": { "./content-model/lintel.schema.json": "content-model/**/*.yaml" } }
```

## In development: two-way sync

While `pnpm dev` runs:

- **Saving a file** applies it straight away, and open admin screens reload to show it.
- **Changing something in the admin** (adding a field, renaming a taxonomy) rewrites its
  file. Files are written the same way every time: keys in a fixed order, defaults left
  out, laid out as Prettier would, so diffs show only what changed. Comments at the top
  of a file are kept; files that didn't change aren't touched.
- **If both changed** at once, the file wins and the admin shows a notice saying the change
  made there was undone.
- If a file can't be read (a syntax error, an unknown option), nothing is applied and the
  content types screen shows the problem, with the file it's in.

## In production: the files decide

When the server starts it compares the files with the database and applies the
differences. Anything that only adds or changes settings is applied automatically.
Anything that would **delete content** waits:

- removing a field that has content, or a content type, block type, taxonomy, global set
  or menu that has any;
- changing a field's type when entries have values for it;
- changing a page tree to a list when pages have parents.

The content types screen then lists each change with what it would delete, in plain
English ("Removing `excerpt` would delete text from 14 entries in Blog posts"), and an
administrator can confirm it there. Or confirm it from a deploy script:

```bash
pnpm --filter @lintel/core model push --allow-data-loss --yes
```

A removal with nothing to lose (a field nobody has filled in) isn't held back.

In production the admin can't change the content model: its screens say it's **managed in
code** and the API refuses the change. Content stays fully editable, and so does a
collection's preview address, which is different on every computer and isn't kept in the
files.

## Commands

| Command                                        | What it does                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| `model pull [--format yaml]`                   | Database → files: writes every file, removes files for what's gone |
| `model diff [--exit-code]`                     | What `push` would change, with what each change would delete       |
| `model push [--yes] [--allow-data-loss]`       | Files → database, after showing the changes and asking             |
| `model types [--out <file>] [--from database]` | TypeScript types and a typed delivery client (see below)           |
| `model check [--types <file>]`                 | For CI: every file is valid, and each types file is up to date     |

Run them as `pnpm --filter @lintel/core model <command>`. Paths are relative to where you
run the command.

## Typed content for your website

`model types` writes one self-contained TypeScript file (no imports, so copy it anywhere)
with an interface for each content type's delivered data and a small client:

```ts
import { createLintelClient } from "./lintel.generated";

const lintel = createLintelClient({ apiUrl: process.env.LINTEL_API_URL! });
const recipe = await lintel.getEntry("recipes", "lemon-tart");
recipe?.data.cooking_time; // number | null
recipe?.data.photo.url; // required, so never null
```

Required fields aren't nullable, select fields are unions of their values, and blocks are
a union you can switch on by `type`. The [Next.js starter](/building/nextjs-starter/)
uses it in `lib/lintel.generated.ts`. Add `model check --types <file>` to CI so a field
added without regenerating the types fails the build.

## Settings

| Setting                           | Default                                    |
| --------------------------------- | ------------------------------------------ |
| `CONTENT_MODEL_FOLDER`            | `content-model` (from the repository root) |
| `CONTENT_MODEL_FORMAT`            | `typescript` (for new files)               |
| `CONTENT_MODEL_EDITABLE_IN_ADMIN` | `true` in development, `false` otherwise   |
| `CONTENT_MODEL_TYPES_FILE`        | `generated/lintel-content.ts`              |

Set `CONTENT_MODEL_EDITABLE_IN_ADMIN=true` on a server if you want people to change the
model there too; changes are then saved to its database only, and the next deploy's
files win.

## Coming from Statamic or Umbraco

| You know                                    | In Lintel                                                     |
| ------------------------------------------- | ------------------------------------------------------------- |
| Statamic blueprints (YAML files)            | Content model files, TypeScript or YAML, one per content type |
| Statamic's control panel editing blueprints | The admin, writing the files back in development              |
| Umbraco uSync / Deploy schema               | `model push`, and the automatic sync when the server starts   |
| uSync's "would delete" report               | The impact report: every destructive change, in plain English |
| Umbraco Models Builder                      | `model types`: interfaces per content type and a typed client |

Two differences worth knowing: Lintel's files and database are compared as a whole, so
there's no export step to forget, and data loss is never silent: a change that would
delete content needs an explicit confirmation every time.
