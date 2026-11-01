# Blocks (the site's own)

A block is one of the site's own reusable designs with properties editors fill in, such as a
Team card with a Name, a Photo, a Role and a "Show LinkedIn" toggle. The page model's side
(instances, drawing them, making one) is `packages/builder-model/src/custom-blocks`; the
reasoning is in docs/decisions/0023-custom-blocks.md.

## Where blocks come from

| Source   | Made                                                    | Stored                 | Changed in |
| -------- | ------------------------------------------------------- | ---------------------- | ---------- |
| `site`   | "Make into a block" in the builder                      | `blocks` row, a design | the admin  |
| `code`   | `content-model/blocks/<handle>.block.ts`, `defineBlock` | `blocks` row, synced   | its file   |
| `plugin` | a plugin's `blocks` (`definePlugin`)                    | not stored             | the plugin |

Code blocks are a template (`{{property}}` slots) or a React component; the server draws
React ones (`block-rendering.ts`) and the HTML goes with the page's data, so the canvas, the
website and static publishing show the same thing. Plugin blocks are offered only while the
plugin is switched on, and their handles start with the plugin's id: `bookings_slot_picker`.

## How pages hold them

- **Page designs** store each instance as `{ type: "customBlock", props: { block, values } }`.
  Saving checks every instance's values against its block's properties with the entry rules
  (`block-instances.ts`, run by the page fieldtype): required, validation, conditions, and
  values of removed properties dropped.
- **Blocks fields** offer a block with a block type that names it,
  `{ handle: "team_card", block: "team_card" }`. Saving a content type fills in the block's
  name, description and properties as the block type's fields (`site-block-types.ts`), and
  saving the block refreshes them, the way Fieldset fields keep a copy. From there it is an
  ordinary block type: the editor, checking, the delivery API and GraphQL need nothing new.
  The website draws these sections with the builder's renderer too (`website/designed-blocks.ts`).

## Changing a block in use

- **Design**: every page shows the new design straight away; instances keep only values.
- **Renaming a property** (`renamedProperties` in the request): values in saved and published
  pages move to the new handle, the design's bindings follow, and the old handle is remembered
  on the block so older revisions still read.
- **Removing a property** pages have filled in: 409 `BLOCK_CHANGE_NEEDS_CONFIRMATION` with the
  pages, until the request says `confirmRemovals`.
- **Deleting** a block in use: 409 `BLOCK_IN_USE` with the pages, unless `?convert=true`,
  which turns every instance into the plain elements of its design first (values typed in) and
  leaves blocks fields' block types as ordinary ones with the same fields.

## Endpoints

| Method and path          | Permission       | Success                                        |
| ------------------------ | ---------------- | ---------------------------------------------- |
| `GET /blocks`            | `entries:read`   | 200 `{ blocks: [Block] }`                      |
| `POST /blocks`           | `builder:blocks` | 201 `Block`                                    |
| `GET /blocks/:handle`    | `entries:read`   | 200 `Block`                                    |
| `PUT /blocks/:handle`    | `builder:blocks` | 200 `Block`, or 409 as above                   |
| `DELETE /blocks/:handle` | `builder:blocks` | 204, or 409 `BLOCK_IN_USE`; `?convert=true`    |
| `POST /blocks/render`    | `entries:read`   | 200 `{ html: { [instanceId]: html } }` (React) |

`Block = { id, handle, name, icon, category, description, source, properties, design, template, renamedProperties, version, editable, usedOn: [{ entryId, title, collection }], usedIn: [content type name], updatedAt }`

Code and plugin blocks answer 409 `BLOCK_NOT_EDITABLE` to changes. Anyone who can edit a
page can use blocks; `builder:blocks` (Owners and Admins) makes and changes them.

## Files

| File                   | What it does                                                       |
| ---------------------- | ------------------------------------------------------------------ |
| `blocks.table.ts`      | The table (with `tenantId()`)                                      |
| `blocks.schema.ts`     | Requests and responses                                             |
| `blocks.routes.ts`     | The endpoints                                                      |
| `blocks.service.ts`    | Rules: the library, saving, renames, removals, usage, deleting     |
| `blocks.repository.ts` | Database reads and writes                                          |
| `blocks.errors.ts`     | Named errors                                                       |
| `block-definition.ts`  | `defineBlock`, for block files and plugins                         |
| `define-block.ts`      | Checking a definition; React components and plugins' blocks        |
| `block-design.ts`      | Checking a design and its bindings; renaming bindings              |
| `block-instances.ts`   | Checking instances' values when a page is saved                    |
| `block-values.ts`      | Finding and changing what pages hold of a block                    |
| `block-rendering.ts`   | A page's block data: the blocks, their pictures, server-drawn HTML |
| `site-block-types.ts`  | Blocks in content types' blocks fields                             |
