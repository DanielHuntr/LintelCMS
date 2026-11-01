# Fieldsets

A fieldset is a saved set of fields, such as "SEO" (a title and description for search
engines), that content types and global sets reuse with a Fieldset field. Change the
fieldset and every content type using it changes too.

## How it fits together

- A Fieldset field (`type: "fieldset"`, see src/fieldtypes/container-fieldtypes.ts) names
  its fieldset in `options.fieldset` and keeps a copy of its fields in `options.fields`. The
  copy is what everything else reads, so the editor, the delivery API and GraphQL treat it
  exactly like a group: values live in the entry under the Fieldset field's handle,
  `{ "search": { "meta_title": "..." } }`.
- The copy is filled in whenever a content type or global set is saved
  (`fillFieldsetImports`, called by their services), and refreshed in every content type and
  global set using a fieldset whenever the fieldset is saved (`refreshFieldsetUsers`).
- A fieldset can't hold another fieldset or a tab, and can't be deleted while anything uses
  it (409 `FIELDSET_IN_USE`).
- As code, fieldsets are files in `content-model/fieldsets/` (`defineFieldset`), read before
  content types so their fields can be copied in; files never write the copy themselves.

## Endpoints

| Method and path             | Permission          | Success                         |
| --------------------------- | ------------------- | ------------------------------- |
| `GET /fieldsets`            | `blueprints:read`   | 200 `{ fieldsets: [Fieldset] }` |
| `POST /fieldsets`           | `blueprints:update` | 201 `Fieldset`                  |
| `GET /fieldsets/:handle`    | `blueprints:read`   | 200 `Fieldset`                  |
| `PUT /fieldsets/:handle`    | `blueprints:update` | 200 `Fieldset`                  |
| `DELETE /fieldsets/:handle` | `blueprints:update` | 204, or 409 when in use         |

`Fieldset = { id, handle, name, fields, usedBy: [name], updatedAt }`

## Files

| File                      | What it does                                               |
| ------------------------- | ---------------------------------------------------------- |
| `fieldsets.table.ts`      | The table (with `tenantId()`)                              |
| `fieldsets.schema.ts`     | Requests and responses                                     |
| `fieldsets.routes.ts`     | The endpoints                                              |
| `fieldsets.service.ts`    | Rules: checking, refreshing users, refusing deletes in use |
| `fieldsets.repository.ts` | Database reads and writes                                  |
| `fieldset-imports.ts`     | Filling in and finding Fieldset fields in lists of fields  |
| `fieldsets.errors.ts`     | Named errors                                               |
