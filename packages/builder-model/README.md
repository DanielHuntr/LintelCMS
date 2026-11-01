# @lintel/builder-model

The page builder's document model, in plain TypeScript (it depends on Zod, and on
`@lintel/motion` for the animation spec's schema and presets). The
server uses it to check pages before saving them, the editor (`@lintel/builder`) to change
them, and the website to draw them. Nothing here touches React or the DOM.

docs/decisions/0015-page-documents.md explains why the model looks the way it does.

## A page

```json
{
  "version": 1,
  "root": {
    "id": "page",
    "type": "page",
    "name": "",
    "props": {},
    "styles": { "base": {} },
    "hidden": false,
    "locked": false,
    "children": [
      {
        "id": "k3j9x2m4pq",
        "type": "heading",
        "name": "Hero title",
        "props": { "text": "Welcome", "level": 1 },
        "styles": { "base": { "fontSize": "3rem" }, "phone": { "fontSize": "2rem" }, "hover": {} },
        "children": [],
        "hidden": false,
        "locked": false
      }
    ]
  }
}
```

- `props` are what a node shows; each component's Zod schema checks them.
- `animation` (optional) is how it moves: `{ spec, presetId? }`, where `spec` is an
  animation spec from `@lintel/motion`, checked by its schema when the page is saved.
- `styles` are how it looks: `base` (desktop and up), `tablet` and `phone` cascade down,
  `hover` and `focus` are states. Only properties in `styles/style-properties.ts` are allowed,
  and values can't break out of their declaration (`styles/style-values.ts` checks the
  layered ones: background and mask pictures, shapes, filters, skews).
- `freeLayout` (optional, on sections, boxes and containers) places the children anywhere
  in it; `backgroundVideo` (optional) plays a muted video behind its content.
- The page element's `fonts` prop lists fonts added to the theme's; headings and paragraphs
  may have `marks`, styles on part of their text.

## Folders

| Folder           | What it holds                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------- |
| `document/`      | The schema, `createEmptyPage`, `migrateDocument` and `validatePageDocument`                 |
| `components/`    | `ComponentDefinition`, the standard components and `createComponentCatalogue`               |
| `styles/`        | Allowed properties, the breakpoint cascade, class names and `compileStylesheet`             |
| `tokens/`        | The site's design tokens (`--lintel-color-brand`...) as the style panel offers them         |
| `free-layout/`   | Free layout: the styles it implies, places as percentages, bring forward and send back      |
| `backgrounds/`   | Background videos                                                                           |
| `fonts/`         | The bundled font catalogue (files in `fonts/` at the package root) and a page's fonts       |
| `text-marks/`    | Styles on part of a text: applying, clearing, moving with edits, drawing as `<em>`/`<span>` |
| `tree/`          | Reading (`findPath`, `listVisibleRows`) and changing (`moveNode`, `duplicateNode`) trees    |
| `html/`          | A small HTML parser and writer, `formatHtml` for the code view, and `importHtml`            |
| `code/`          | Code block markers (`data-lintel-field`), script removal and the code permission rule       |
| `templates/`     | The section library: ready-made sections by category, for Insert and the empty page         |
| `sections/`      | The builders sections are made from (heroes, features, prices...), with `animate()`         |
| `starter-sites/` | Six whole starter sites for "Start from a template", and their SVG illustrations            |

Tree changes never modify a tree: they return a new one that shares every untouched node,
so undo can keep whole trees and the editor can skip redrawing unchanged layers.

## Adding a component

Define it with `defineComponent` (type, label, description, icon, category, `propsSchema`,
`defaultProps`, `allowedChildren`, `editableFields`) and pass it, with `standardComponents`,
to `createComponentCatalogue`. Give its drawing to `@lintel/builder` as well, and add it to
the server's list in `packages/core/src/pages/page-components.ts` so saved pages can use it.

## Changing the document shape

Raise `pageDocumentVersion` and add a migration to `documentMigrations` in
`document/migrations.ts`. Stored pages are migrated when read; there's no database script.
