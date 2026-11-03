# Your site's blocks

The admin's side of the site's own blocks (see `packages/core/src/blocks` and
docs/decisions/0027-custom-blocks.md): reusable designs with properties editors fill in.

## Screens

| Route                           | Screen            | What it does                                                    |
| ------------------------------- | ----------------- | --------------------------------------------------------------- |
| `/design/blocks`                | `BlocksPage`      | Every block by group, who looks after it, how many pages use it |
| `/design/blocks/:handle`        | `BlockEditorPage` | Name, icon, group; properties; preview; where used; delete      |
| `/design/blocks/:handle/design` | `BlockDesignPage` | The design in the builder, full screen, bound to properties     |

Design links to the list. Blocks from code and plugins are shown read-only.

- **Properties** are built with the content types' `FieldsBuilder`, so they have the same
  field types and settings (widths, conditions, validation, defaults, help text). Saving
  sends renamed handles (`blockChanges.ts`) so pages keep their values; removing properties
  pages filled in asks first, listing the pages (409 `BLOCK_CHANGE_NEEDS_CONFIRMATION`).
- **Deleting** a block pages use asks first, then turns its instances into ordinary elements.

## In the page builder

`useBuilderBlocks` gives `PageBuilder` its `blocks`: the library, the pictures image properties
point at (`useBlockPictures`), HTML the server draws for React blocks in code
(`useServerBlocks`), saving a block made with **Make into a block** (with `builder:blocks`),
opening a block's design, and the property form (`BlockPropertyForm`), drawn by `FieldGrid`
and `FieldEditor` like any entry's fields.

## In blocks fields

A content type's blocks field can offer one of the site's blocks (**Add one of your site's
blocks** in the field's settings). Its fields are the block's properties, kept up to date by
the API, and each block shows a live preview under its fields (`SiteBlockPreview`), drawn by
the same renderer as the website (`BlockPreview`, loaded lazily).
