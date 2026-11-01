# Content types

The blueprint builder, at `/settings/content-types`. A content type is a blueprint (the fields
an entry has) plus a collection (where its entries live). People only ever see "content type".

| Route                             | File                      |
| --------------------------------- | ------------------------- |
| `/settings/content-types`         | `ContentTypesPage.tsx`    |
| `/settings/content-types/new`     | `NewContentTypePage.tsx`  |
| `/settings/content-types/:handle` | `BlueprintEditorPage.tsx` |

## How the builder works

- `blueprintDraft.ts` holds the builder's rules as a reducer: add, change, reorder and remove
  fields. Each field has a `key` that never changes, because its handle can be edited.
  The title field is always first and can only be relabelled.
- `handle.ts` makes handles from labels ("Hero image" → `hero_image`). A new field's handle
  follows its label until it's edited by hand; a saved field's handle never changes on its own,
  because entries store their content under it.
- "Add field" (`AddFieldSheet.tsx`) lists the fieldtypes from `GET /fieldtypes` with their
  plain descriptions. Picking one adds the field and opens its settings (`FieldSettingsSheet.tsx`).
- Changes are saved together with Save (`PUT /blueprints/:handle`). Problems are checked here
  first (`blueprintProblems`), then any the API finds are shown on the right rows.

## New content types

`NewContentTypePage.tsx` asks for a name and, in plain words, how entries are organised:
"Pages with parents and children" (tree), "Posts by date" (dated) or "A simple list" (flat).
`createContentType.ts` then creates the blueprint (with just a title) and the collection, and
the builder opens so fields can be added. If the collection step fails, a retry skips the
blueprint that was already made.
