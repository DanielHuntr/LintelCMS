# 23. A site's own blocks are designs with properties, drawn into pages when they are drawn

Date: 2026-11-01

## Context

Agencies and editors asked for Umbraco's element types and Block Grid, or Webflow's
components: a piece of design made once (a team card, a quote), used on many pages, filled in
through a simple form, and changed in one place. Lintel already had most of the parts: page
designs as trees of known components (0015), node `bindings` that fill an element's props from
an entry's fields (collection lists), the field editor's types and settings with a shared
condition evaluator (0022), content model as code (0016), plugins (0012) and blocks fields.

## Decision

- **One element per instance, values only.** A page stores an instance as
  `{ type: "customBlock", props: { block, values } }`. The design lives in the block (the
  `blocks` table). Before a page is drawn, `expandBlockInstances` gives each instance a copy
  of its block's design with the values put in, and the one renderer draws it. Changing the
  design changes every page, with nothing to rewrite.
- **Properties are fields; mappings are bindings.** A block's properties are field
  definitions, checked with a blueprint's rules and edited with the content types' field
  builder. Inside a design, `bindings` point at properties instead of an entry's fields, so
  `bindProps` does the work, plus three keys of their own: `visible` (a toggle shows or hides
  the element), `style.<colour>` (a colour property sets a safe colour) and `items` (a repeater
  repeats the children).
- **The server checks values on save** with the entry validator (required, validation,
  conditions), through the page fieldtype's nested check, given the block library in the
  check context.
- **Blocks fields copy, like fieldsets.** A block type that names a block gets the block's
  properties as its fields, refreshed when the block is saved, so the editor, delivery and
  GraphQL need nothing new. The website draws those sections with the builder's renderer.
- **Three sources.** Blocks made in the builder are content (`source: "site"`), editable in
  the admin and never written to files. Blocks in `content-model/blocks/*.block.ts` are part of
  the content model, synced like content types and read-only in the admin. Plugins' blocks
  come from `definePlugin` while the plugin is on and aren't stored. Code blocks render with a
  `{{slot}}` template (stored, drawn anywhere) or a React component (kept in memory from the
  file, drawn by the server, its HTML sent with the page's data).
- **Changes that would lose values ask first.** Renamed properties move values in saved and
  published pages and are remembered on the block for older revisions. Removing a property
  pages filled in, or deleting a block in use, is refused until confirmed; deleting can turn
  instances into plain elements first.
- **`builder:blocks`** lets people make, change and delete blocks; anyone who can edit a page
  can use them.

## Why

Expanding at draw time, rather than copying the design into each page, is what makes "edit
the master and every instance updates" true with no migration, and keeps the canvas, the
website, static publishing and previews identical because they share one renderer. Reusing
bindings and field definitions means a block's form is the same form editors already know,
and the server's rules are the same ones entries follow, so there is one place for each rule.

Copying properties into blocks fields mirrors fieldsets (0022): every reader of blueprints
keeps working, at the cost of refreshing copies when a block is saved.

## Alternatives considered

- **A component type per block in the catalogue**: nicer type names in Layers, but every
  site would need its own catalogue on the server and in the editor, and pages couldn't be
  checked without loading the site's blocks first.
- **Storing the expanded design in each page** (Webflow's detach-by-default): simple to draw,
  but a design change would have to rewrite every page and revision.
- **Writing builder-made blocks to files**: their designs are large JSON trees that people
  don't review by hand; they are content, like pages.

## Consequences

- A block can't contain another block, which keeps expansion a single pass.
- Each instance's copy has its own ids (`<instance>-<element>`) and class names, so a page
  with many instances repeats a little CSS.
- React blocks from files need the server to have read the folder (it does at start), and
  the canvas asks the server to draw them (`POST /blocks/render`).
- Variants (one block with light and dark designs) aren't built; a block can be duplicated
  in the builder and made into a second block instead.
