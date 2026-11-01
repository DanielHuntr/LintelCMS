# 15. Page designs are versioned JSON trees in an ordinary field

Date: 2026-11-01

## Decision

A page laid out in the visual builder is stored as one JSON document in a blueprint field of
type `page` (see `packages/builder-model`):

- a tree of nodes, each with a `type`, `props` (what it shows, checked by the component's
  Zod schema) and `styles` (how it looks: `base`, `tablet` and `phone` cascading down, plus
  `hover` and `focus`);
- a `version`, raised whenever the shape changes, with a migration for each step. Stored
  pages are migrated when read, so there is no database script;
- only style properties from one allowed list, with values that can't escape their
  declaration.

The server checks the whole tree on every save (`validatePageDocument`). One renderer
(`@lintel/builder/render`) draws the builder's canvas and the published page, on the
built-in website too.

## Why

Keeping the design in a field means drafts, publishing, scheduling, revisions, translations
and the delivery API work for designs with no extra code. A tree of known components, rather
than free HTML, lets non-technical editors change a design without breaking it, lets the
server refuse anything unsafe, and lets the same page be drawn identically in the editor
and on the site. The version number lets the model grow without stranding old pages.

## Consequences

- Code blocks are the one place for free HTML, CSS and JavaScript. Writing them needs the
  `builder:code` permission, and scripts follow the site's `builderCustomScripts` rule.
- A site's own components must be added to the server's list
  (`packages/core/src/pages/page-components.ts`) as well as to the editor, or saving a page
  that uses them is refused.
- Styles are compiled to one class per element, so a design's stylesheet only depends on
  the design.
