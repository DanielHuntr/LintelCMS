# The site's blocks in the builder

Blocks are a site's own reusable designs with properties (see
`packages/builder-model/src/custom-blocks` and docs/decisions/0023-custom-blocks.md). The app
passes them to `PageBuilder` as `blocks` (`BuilderBlocks`):

- **Insert** lists each block first under "Your site's blocks", searchable by name, group and
  description (`blockInsertItems`). Pressing one adds an instance with no values, which looks
  exactly like the block's design.
- **The canvas** draws instances as their design (`renderPage` expands them). Only the
  instance is selectable; its design is drawn as copies, so it can't be changed by accident.
- **The right-hand panel** shows `BlockInstancePanel` for a selected instance: the block's
  property form, drawn by the app's own field editors through `renderProperties` (a simple form
  without it), **Edit block design** for people with `builder:blocks` (`canManage`) on blocks made
  in the builder, and **Detach from block**, which asks first and then puts the design's plain
  elements, with the values typed in, where the instance was.
- **Make into a block** (`BlockTools`, under the panel, with `canManage` and `create`) opens
  `MakeBlockDialog`: a name, an icon, a group for Insert, then every part of the design editors
  could change (words, pictures, links, showing or hiding, colours, a list of repeated cards),
  to tick and name. The app saves the block; the selection is replaced by an instance.

## Editing a block's design

With `blockMaster`, the page is the block's design. Elements' **Shows** pickers offer the
block's properties instead of an entry's fields, and **Choose what editors can change** opens
the same dialog to change the bindings; properties that stay keep their settings
(`remapBlockDesign`). Property settings themselves (help text, widths, validation,
conditions) are edited in the app with the field editor, beside the design.

| File                     | What it holds                                                     |
| ------------------------ | ----------------------------------------------------------------- |
| `blocks-context.tsx`     | `BuilderBlocks`, `BlockMaster` and their contexts                 |
| `block-commands.ts`      | Insert items, new instances, the Shows picker's fields, remapping |
| `BlockInstancePanel.tsx` | A selected instance: its form, Edit block design, Detach          |
| `BlockTools.tsx`         | Make into a block, and Choose what editors can change             |
| `MakeBlockDialog.tsx`    | The dialog both use                                               |
