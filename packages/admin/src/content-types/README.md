# Content types

The blueprint builder, at `/build/content-types`. A content type is a blueprint (the fields
an entry has) plus a collection (where its entries live). People only ever see "content type".

| Route                          | File                      |
| ------------------------------ | ------------------------- |
| `/build/content-types`         | `ContentTypesPage.tsx`    |
| `/build/content-types/new`     | `NewContentTypePage.tsx`  |
| `/build/content-types/:handle` | `BlueprintEditorPage.tsx` |

## How the builder works

- `blueprintDraft.ts` holds the builder's rules as a reducer: add, change, reorder and remove
  fields. Each field has a `key` that never changes, because its handle can be edited.
  The title field is always first and can only be relabelled.
- `handle.ts` makes handles from labels ("Hero image" → `hero_image`). A new field's handle
  follows its label until it's edited by hand; a saved field's handle never changes on its own,
  because entries store their content under it.
- The canvas (`FieldLayoutCanvas.tsx`, cards in `FieldCard.tsx`) lays the fields out as the
  editor will: on a 12-column grid, each card as wide as the field, split into tabs by Tab
  fields. Drag a card to move it (or use its arrow buttons), drag its right edge (or focus it
  and press left/right) to change the width, and switch to Preview to see the real editor.
  `FieldsBuilder.tsx` puts the canvas, "Add a field" and the settings together; content types,
  global sets and fieldsets all use it.
- "Add a field" (`AddFieldDialog.tsx`) is a wide dialog: a search box with focus, categories
  down the left (from each fieldtype's `category` in `GET /fieldtypes`), "Recently used" first,
  and the chosen category's fieldtypes in a grid. Search matches names, descriptions and
  `keywords` ("dropdown" finds Select); the arrow keys move the highlight and Return adds it.
  The rules are in `fieldtypeSearch.ts`.
- A field's settings (`FieldSettingsDialog.tsx`) are in tabs, with a live preview beside them:
  Basics (`FieldBasicSettings.tsx`: label, handle, help, placeholder, default), Appearance
  (width with `WidthPicker.tsx`, help position, read only, hidden, list column), Conditions
  (`ConditionsEditor.tsx`, with `conditionTargets.ts` choosing which fields and comparisons
  make sense), Validation (`ValidationSettings.tsx`) and Options (`FieldTypeOptions.tsx`).
  `fieldSettingsDraft.ts` cleans the settings for saving and checks them.
- Groups and repeaters list their fields with `InnerFieldsEditor.tsx`, and each inner field
  (and each block type's field) opens the same settings dialog on top, so widths, conditions
  ("$parent." and "$root." too) and validation work inside them. A Fieldset field picks a
  saved fieldset (`FieldsetOptions.tsx`; the fieldsets themselves are in `src/fieldsets`).
- A blocks field's settings list its block types (`BlockTypesEditor.tsx`): each has a name,
  a handle made from the name until edited, a description editors see when adding a block,
  and its own fields (any type except blocks or a tab), each with the full settings dialog.
  `blockTypesDraft.ts` holds the rules; each block type and inner field carries `draft`
  bookkeeping (a stable key, whether its handle follows its name) that isn't saved.
- "Live preview" under the fields connects each collection using the content type to its
  website's preview page (see `src/preview`).
- Changes are saved together with Save (`PUT /blueprints/:handle`). Problems are checked here
  first (`blueprintProblems`), then any the API finds are shown on the right rows.

## New content types

`NewContentTypePage.tsx` asks for a name and, in plain words, how entries are organised:
"Pages with parents and children" (tree), "Posts by date" (dated) or "A simple list" (flat).
`createContentType.ts` then creates the blueprint (with just a title) and the collection, and
the builder opens so fields can be added. If the collection step fails, a retry skips the
blueprint that was already made.

## Managed in code

When the site keeps its content model in files (see `src/content-model-sync`), the list
shows `ModelSyncNotices` and `ManagedInCodeBanner` under the title, and `New content type`
and the builder's Save are hidden while editing is switched off there.
