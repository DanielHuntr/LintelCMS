# Fieldtypes

The kinds of field a blueprint can have: text, rich text, number, image... Each fieldtype
says what options it takes and what a stored value must look like, so one function can
check an entry's values against any blueprint.

## The fieldtypes

| type       | Stored value                                        | Options                                    |
| ---------- | --------------------------------------------------- | ------------------------------------------ |
| `text`     | string                                              | `maxLength?`                               |
| `textarea` | string                                              | `maxLength?`                               |
| `richText` | TipTap/ProseMirror JSON `{ "type": "doc", ... }`    | none                                       |
| `number`   | number                                              | `min?`, `max?`, `step?`                    |
| `toggle`   | boolean                                             | none                                       |
| `select`   | string, or string[] when `multiple`                 | `choices: [{ value, label }]`, `multiple?` |
| `date`     | `YYYY-MM-DD`, or a date and time with `includeTime` | `includeTime?`                             |
| `image`    | asset id (uuid)                                     | none                                       |
| `link`     | `{ url, label? }`                                   | none                                       |
| `email`    | string, an email address                            | none                                       |
| `url`      | string, an `https://` or `http://` address          | none                                       |
| `colour`   | `#rrggbb`, stored in lowercase                      | `swatches?: ["#rrggbb"]` (up to 24)        |
| `markdown` | string                                              | `maxLength?`                               |
| `list`     | string[]; blank items are left out                  | `maxItems?`                                |
| `entries`  | entry ids (uuid[]), in the chosen order             | `collections?: [handle]`, `maxItems?`      |
| `terms`    | term ids (uuid[]), in the chosen order              | `taxonomy` (handle), `maxItems?`           |

Empty values (missing, null, blank text, empty lists, a rich text document with only empty
paragraphs, a link without an address) are stored as null, and are an error only when the
field is `required`. Link addresses must start with `https://`, `http://`, `mailto:`,
`tel:`, `/` or `#`, so a `javascript:` link can't be saved.

## Endpoint

| Method and path   | Permission        | Success                                             |
| ----------------- | ----------------- | --------------------------------------------------- |
| `GET /fieldtypes` | `blueprints:read` | 200 `{ fieldtypes: [{ type, name, description }] }` |

## How checking works

`buildEntryDataValidator(fields, { assetExists })` builds the check for a whole blueprint.
For each field it runs, in order: the empty and required check, the fieldtype's Zod value
schema (built from the field's options), then any outside check (`checkReferences`, used
by `image` to ask the media library whether the asset still exists). It returns the values
to store, without keys that aren't fields, or throws `InvalidFieldsError` with one message
per field, using the field's label:

```json
{
  "fields": { "title": "Title is required", "category": "Category should be one of: News, Guides" }
}
```

`entries` and `terms` always store a list, even with `maxItems: 1`, so code reading them
never has to ask which shape it got. Their ids are checked against the database through
`ContentReferences` (`content-references.ts`), which the entries feature hands in, the same
way images are checked through the media library. When an entry or a term is deleted, its
id is taken out of every list that held it (see `src/entries/entry-references.ts`).

## Images and the media library

Content doesn't import media code. `image-assets.ts` defines the two things it needs:

- `AssetExists`: `(assetId) => Promise<boolean>`, used when an entry is saved;
- `AssetLookup`: `{ findAssetsByIds(ids) => Promise<Map<id, DeliveredAsset>> }`, used by
  the delivery API to expand image ids.

`buildServer` takes both as options (`assetExists`, `assetLookup`) and puts them on the
server as `server.assetExists` and `server.assetLookup`. The defaults, `acceptAnyAsset`
and `findNoAssets`, accept any uuid and expand nothing, so content works before media does.

## Adding a fieldtype

Define it with `defineFieldtype` next to its relatives, then add it to the list in
`fieldtypes.registry.ts`. Nothing is discovered by file name. If the delivery API should
show its values differently, add that to `src/delivery/delivered-values.ts`.

## Files

| File                         | What it does                                                     |
| ---------------------------- | ---------------------------------------------------------------- |
| `fieldtype.ts`               | The `Fieldtype` shape and `defineFieldtype`                      |
| `fieldtypes.registry.ts`     | The list of fieldtypes, in the order the builder shows them      |
| `text-fieldtypes.ts`         | `text`, `textarea`, `richText`                                   |
| `value-fieldtypes.ts`        | `number`, `toggle`, `date`                                       |
| `reference-fieldtypes.ts`    | `select`, `image`, `link`                                        |
| `format-fieldtypes.ts`       | `email`, `url`, `colour`, `markdown`                             |
| `list-fieldtype.ts`          | `list`                                                           |
| `relation-fieldtypes.ts`     | `entries`, `terms`                                               |
| `content-references.ts`      | `ContentReferences`: what entries and terms fields check against |
| `markdown.ts`                | Rendering Markdown to safe HTML for the delivery API             |
| `field-definition.schema.ts` | A field in a blueprint, with its options checked by its type     |
| `entry-data-validator.ts`    | `buildEntryDataValidator`: checking an entry against a blueprint |
| `rich-text.ts`               | Checking rich text documents and rendering them to HTML          |
| `image-assets.ts`            | `AssetExists`, `AssetLookup` and their stand-in defaults         |
| `fieldtypes.service.ts`      | The list `GET /fieldtypes` returns (no repository: it's code)    |
| `fieldtypes.routes.ts`       | The endpoint                                                     |
