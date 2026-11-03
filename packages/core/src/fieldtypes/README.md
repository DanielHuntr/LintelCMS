# Fieldtypes

The kinds of field a blueprint can have: text, rich text, number, image... Each fieldtype
says what options it takes and what a stored value must look like, so one function can
check an entry's values against any blueprint.

## The fieldtypes

| type                       | Stored value                                        | Options                                                              |
| -------------------------- | --------------------------------------------------- | -------------------------------------------------------------------- |
| `text`                     | string                                              | `maxLength?`                                                         |
| `textarea`                 | string                                              | `maxLength?`                                                         |
| `richText`                 | TipTap/ProseMirror JSON `{ "type": "doc", ... }`    | none                                                                 |
| `number`                   | number                                              | `min?`, `max?`, `step?`                                              |
| `toggle`                   | boolean                                             | none                                                                 |
| `select`                   | string, or string[] when `multiple`                 | `choices: [{ value, label }]`, `multiple?`                           |
| `date`                     | `YYYY-MM-DD`, or a date and time with `includeTime` | `includeTime?`                                                       |
| `image`                    | asset id (uuid)                                     | none                                                                 |
| `link`                     | `{ url, label? }`                                   | none                                                                 |
| `email`                    | string, an email address                            | none                                                                 |
| `url`                      | string, an `https://` or `http://` address          | none                                                                 |
| `colour`                   | `#rrggbb`, stored in lowercase                      | `swatches?: ["#rrggbb"]` (up to 24)                                  |
| `markdown`                 | string                                              | `maxLength?`                                                         |
| `list`                     | string[]; blank items are left out                  | `maxItems?`                                                          |
| `entries`                  | entry ids (uuid[]), in the chosen order             | `collections?: [handle]`, `maxItems?`                                |
| `terms`                    | term ids (uuid[]), in the chosen order              | `taxonomy` (handle), `maxItems?`                                     |
| `blocks`                   | `[{ id, type, data }]`, in order                    | `blockTypes: [{ handle, name, description?, fields }]`, `maxBlocks?` |
| `page`                     | a page design `{ version, root }` (see src/pages)   | none                                                                 |
| `form`                     | a form's handle (see `src/forms`)                   | none                                                                 |
| `radio`                    | one choice's value                                  | `choices`, `inline?`                                                 |
| `checkboxes`               | the chosen values, string[]                         | `choices`, `inline?`                                                 |
| `buttonGroup`              | one choice's value                                  | `choices`                                                            |
| `range`                    | number, on a slider                                 | `min` (0), `max` (100), `step` (1), `suffix?`                        |
| `time`                     | `HH:MM`, or `HH:MM:SS`                              | none                                                                 |
| `slug`                     | `summer-fair`: lowercase, numbers, single hyphens   | `from` (the field it follows, `title`)                               |
| `code`                     | string, kept as typed                               | `language` (`plain`), `maxLength?`                                   |
| `table`                    | string[][], every row the same length               | `headerRow` (true), `maxRows?`, `maxColumns?` (at most 20)           |
| `video`                    | a YouTube, Vimeo or https video file address        | none                                                                 |
| `icon`                     | an icon's name, such as `map-pin`                   | none                                                                 |
| `users`                    | user ids (uuid[]), in order                         | `maxItems?`                                                          |
| `hidden`                   | text, a number or true/false                        | none                                                                 |
| `group`                    | `{ handle: value }` of its fields                   | `fields`                                                             |
| `repeater`                 | `[{ id, data }]` rows of its fields                 | `fields`, `minRows?`, `maxRows?`, `addLabel?`                        |
| `fieldset`                 | `{ handle: value }` of the fieldset's fields        | `fieldset` (handle), `fields` (a copy kept by src/fieldsets)         |
| `tab`, `section`, `spacer` | nothing: they arrange the editor                    | none                                                                 |
| `revealer`                 | boolean: a Show more button conditions look at      | `buttonLabel?`                                                       |

Every fieldtype also says where the builder's "Add a field" lists it (`category`), other
words people search for it by (`keywords`), whether it holds a value (`holdsValue`: false for
tabs, sections and spacers, which store nothing and never reach the API) and whether it can
go inside a group, repeater or block (`canBeInside`: not blocks or tabs).

## Settings every field shares

Beside `options`, a field can say (field-settings.schema.ts), each left out when it is the
default so older blueprints read the same:

| Setting            | What it does                                                           |
| ------------------ | ---------------------------------------------------------------------- |
| `width`            | 25, 33, 50, 66, 75 or 100 (percent of the editor's row)                |
| `placeholder`      | grey example text in an empty input                                    |
| `default`          | what a new entry starts with; checked against the fieldtype when saved |
| `helpTextPosition` | `above` or `below` (the default)                                       |
| `readOnly`         | shown but not editable in the admin                                    |
| `hidden`           | kept out of the editor; the value is still saved and delivered         |
| `showInList`       | a column in the list of entries (`columns` in `GET .../entries`)       |
| `validation`       | `minLength`, `maxLength`, `min`, `max`, `pattern`, `unique`, `message` |
| `conditions`       | show or hide the field depending on others; see below                  |

`validation` applies after the fieldtype's own checks (field-validation.ts): lengths and a
pattern for text, `min`/`max` for numbers or for how many items a list has. `unique` asks the
caller (`isValueUnique` in the context): entries check other entries in the same collection
and language when a person saves. `message` replaces Lintel's message for any of these.

## Conditions

`conditions` use `@lintel/field-conditions` (packages/field-conditions), the same rules the
admin applies as people type: `{ action: "show" | "hide", match: "all" | "any", rules: [{ field,
operator, value }], keepHiddenValues }`. When an entry is saved, a hidden field isn't checked
(so it is never required) and its value is cleared, or kept as it was if `keepHiddenValues`.
Fields in a group, repeater row or block see their own level's values, and outer ones with
"$parent." and "$root.". When a blueprint is saved, every rule has to point at a field beside
it (or, with "$root.", one of the blueprint's own); condition-references.ts checks that.

Empty values (missing, null, blank text, empty lists, a rich text document with only empty
paragraphs, a link without an address) are stored as null, and are an error only when the
field is `required` and the caller enforces required fields. Entries enforce them when
publishing and scheduling; saving a draft enforces only the title (`requiredFields` and
`alwaysRequired` in `FieldCheckContext`). Link addresses must start with `https://`, `http://`, `mailto:`,
`tel:`, `/` or `#`, so a `javascript:` link can't be saved.

## Blocks (the page builder)

A `blocks` field holds an ordered list of blocks. Each block type the blueprint defines
(Hero, Text, Call to action...) has its own `fields`, which are ordinary field definitions
of any type except `blocks`, checked the same way when the blueprint is saved
(`checkInnerFields`). Each stored block has an `id` the admin makes when the block is
added; it never changes, so messages and moves follow the block.

Saving checks each block against its block type (`checkNestedValues`), using the same rules
as an entry's own fields. Problems come back keyed by the field, then the block id:

```json
{
  "fields": {
    "sections": "Hero (block 1): Heading is required",
    "sections.0b6c9c4e-....heading": "Heading is required"
  }
}
```

A block type can be one of the site's own blocks (`{ handle, block: "team_card" }`): its
name, description and fields are then a copy of the block's properties, kept up to date by
src/blocks.

Blocks of a type that has since been removed from the blueprint are dropped on save, the
way values of a removed field are. The delivery API serves the list as `[{ id, type, data }]`
with each block's `data` expanded like an entry's (images, rich text).

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
| `choice-fieldtypes.ts`       | `radio`, `checkboxes`, `buttonGroup`                             |
| `measure-fieldtypes.ts`      | `range`, `time`                                                  |
| `writing-fieldtypes.ts`      | `slug`, `code`, `hidden`                                         |
| `media-fieldtypes.ts`        | `video`, `icon` (addresses in `video-addresses.ts`)              |
| `table-fieldtype.ts`         | `table`                                                          |
| `container-fieldtypes.ts`    | `group`, `repeater`, `fieldset`                                  |
| `layout-fieldtypes.ts`       | `tab`, `section`, `spacer`, `revealer`                           |
| `field-settings.schema.ts`   | Width, placeholder, default, validation, conditions...           |
| `field-validation.ts`        | A field's own validation rules                                   |
| `condition-references.ts`    | Conditions point at fields that exist                            |
| `relation-fieldtypes.ts`     | `entries`, `terms`, `users`                                      |
| `content-references.ts`      | `ContentReferences`: what entries and terms fields check against |
| `markdown.ts`                | Rendering Markdown to safe HTML for the delivery API             |
| `blocks-fieldtype.ts`        | `blocks`: block types and their fields, and checking each block  |
| `page-fieldtype.ts`          | `page`: a visual builder design, checked with its code rules     |
| `field-definition.schema.ts` | A field in a blueprint, with its options checked by its type     |
| `entry-data-validator.ts`    | `buildEntryDataValidator`: checking an entry against a blueprint |
| `rich-text.ts`               | Checking rich text documents and rendering them to HTML          |
| `image-assets.ts`            | `AssetExists`, `AssetLookup` and their stand-in defaults         |
| `fieldtypes.service.ts`      | The list `GET /fieldtypes` returns (no repository: it's code)    |
| `fieldtypes.routes.ts`       | The endpoint                                                     |
