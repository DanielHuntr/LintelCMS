# Content model sync

Content model as code: content types (a blueprint with its collections), taxonomies,
global sets, fieldsets and menus kept as files in `content-model/` at the repository root, one file
each, and kept in step with the database. The developer guide is
`packages/docs/src/content/docs/building/content-model-as-code.md`; the reasoning is in
`docs/decisions/0016-content-model-as-code.md`.

```ts
// content-model/content-types/post.ts
import {
  defineContentType,
  image,
  richText,
  terms,
  text,
  textarea,
} from "@lintel/core/content-model";

export default defineContentType({
  handle: "post",
  name: "Blog post",
  collection: { handle: "posts", name: "Blog posts", structure: "dated", route: "/blog/{slug}" },
  fields: {
    title: text(),
    excerpt: textarea({ helpText: "Shown in lists of posts and in link previews" }),
    categories: terms({ taxonomy: "categories", maxItems: 3 }),
  },
});
```

Fields keep their layout and rules in files too: `width`, `conditions`, `validation`,
`placeholder`, `default` and the rest (see src/fieldtypes/README.md), groups and repeaters
with their own `fields`, and `fieldset({ fieldset: "seo" })` for a fieldset defined in
`fieldsets/seo.ts`. Fieldset files are read first, and each Fieldset field gets a copy of the
fieldset's fields, as the admin stores it; the copy is never written back to a file.

## How it fits together

```text
 files ──read (jiti / yaml)──> definitions ──model-from-definitions──┐
                                                                     ├─> ContentModel (units)
 database ──model-database──────────────────────────────────────────┘        │
                                                                   model-diff → model-impact
                                                                              │
                                     apply-model.service (through the admin's services)
```

- **One comparable form.** Files and the database are both read into a `ContentModel`: a
  map of units keyed `contentType:post`, `taxonomy:tags`... with fields stored exactly as
  the admin stores them, defaults filled in. Two units are equal when their canonical JSON is.
- **The admin's rules.** Definitions are checked with the same schemas and field checks as
  the admin's requests (`checkBlueprintFields`, `createCollectionRequestSchema`...), and
  applied through the same services, so a file can't make what the builder would refuse.
- **Who wins** is decided per unit in `model-sync-plan.ts`: in production always the files;
  in development whichever side changed since the last sync (a hash per unit, kept in the
  `contentModelSyncBase` setting), and the file when both did, with a notice for the admin.
- **Nothing is lost silently.** `model-impact.ts` looks at the stored values: a change that
  would delete content (removing a field, block type, collection, taxonomy, global set or
  menu that has any; changing a field's type when it has values; flattening a page tree
  with parents) is destructive. Its unit is held back until someone confirms it.
  Applying then takes the values that no longer fit out of entries and global sets.

## When it runs

`registerContentModelSync` (called from `buildServer` when `contentModel` options are given;
`main.ts` gives them from the CONTENT_MODEL_* settings) adds:

- the routes below;
- a `preHandler` hook refusing schema changes (`model-lock.ts`) while editing is off;
- an `onResponse` hook that, in development, syncs shortly after any admin change;
- the first sync when the server is ready, and in development a watcher on the folder.

Nothing happens while the folder doesn't exist.

## Endpoints

| Method and path                           | Permission          | Success                        |
| ----------------------------------------- | ------------------- | ------------------------------ |
| `GET /content-model/status`               | `blueprints:read`   | 200 `ModelSyncStatus`          |
| `GET /content-model/events`               | `blueprints:read`   | `text/event-stream`, see below |
| `POST /content-model/pending/apply`       | `blueprints:update` | 200 `ModelSyncStatus`          |
| `DELETE /content-model/notices/:noticeId` | `blueprints:read`   | 204                            |

`ModelSyncStatus = { managedInCode, editableInAdmin, folder, mode, pending: [{ summary, impact, destructive }], notices: [{ id, message, createdAt }], problems: [string] }`

The event stream sends `model-changed` (reload content types and the rest) and
`status-changed` (reload the status). While editing is off, schema changes answer 409
`CONTENT_MODEL_MANAGED_IN_CODE`; applying with nothing pending is 409
`NO_PENDING_MODEL_CHANGES`.

## Commands

The functions are in `model-commands.ts`; `src/scripts/model.ts` is a thin command line
until the `lintel` CLI has them:

```bash
pnpm --filter @lintel/core model pull [--format typescript|yaml]
pnpm --filter @lintel/core model push [--yes] [--allow-data-loss]
pnpm --filter @lintel/core model diff [--exit-code]
pnpm --filter @lintel/core model types [--out <file>] [--from database]
pnpm --filter @lintel/core model check [--types <file>]
```

To wire them into `lintel model ...`, call `pullModel`, `diffModel`, `pushModel`,
`writeModelTypes` and `checkModel` with `contentModelOptionsFromConfig(loadConfig())`, the
way the script does, and print `describeChanges` for diff and push.

## Files

| File                                       | What it does                                                           |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| `content-model.ts`                         | What model files import, as `@lintel/core/content-model`               |
| `define-content-model.ts`                  | `defineContentType`, `defineTaxonomy`, `defineGlobalSet`, `defineMenu` |
| `field-helpers.ts`                         | `text()`, `blocks({...})`...: one per fieldtype, with JSDoc            |
| `model-definition.schema.ts`               | The file format's shape, and the JSON Schema for YAML                  |
| `content-model.schema.ts`                  | The comparable model: units, keys, canonical JSON                      |
| `model-from-definitions.ts`                | Definitions → model, with every problem named by file                  |
| `model-to-definitions.ts`                  | Model → definitions, leaving defaults out                              |
| `typescript-printer.ts`, `yaml-printer.ts` | Writing a unit as a file, the same way every time                      |
| `model-files.ts`                           | Reading and writing the folder                                         |
| `model-database.ts`                        | The model as the database has it                                       |
| `model-diff.ts`                            | The changes between two models                                         |
| `model-impact.ts`                          | Each change in plain English, and what it would delete                 |
| `stored-values.ts`                         | Whether stored values hold something, and pruning them                 |
| `apply-model.service.ts`                   | Making the database match a model                                      |
| `model-sync-plan.ts`                       | Which side wins, per unit                                              |
| `model-sync.service.ts`                    | `ContentModelSync`: syncing while the server runs, the status          |
| `model-lock.ts`                            | Which requests change the model                                        |
| `model-events.ts`                          | Telling open admin screens to reload                                   |
| `register-content-model-sync.ts`           | Routes and hooks on the server                                         |
| `content-model-sync.routes.ts`             | The endpoints                                                          |
| `content-model-sync.repository.ts`         | Database reads and writes                                              |
| `content-model-sync.errors.ts`             | Named errors                                                           |
| `content-model-config.ts`                  | Options from the CONTENT_MODEL_* settings                              |
| `generate-types.ts`                        | `model types`: delivered types and a typed client                      |
| `default-content-model.ts`                 | The model a new site with the blog has (for the starter's types)       |
| `model-commands.ts`                        | pull, push, diff, types, check                                         |
