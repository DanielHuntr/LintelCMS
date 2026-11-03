# Liquid templates

Page templates written as Liquid files in the project, for developers who would rather write
HTML than use the visual designer. The built-in website (`src/website`) draws an entry's
page with one when its collection has a template, or the entry chose one; otherwise nothing
changes. Docs: `packages/docs/src/content/docs/building/liquid-templates.md`. Decision:
`docs/decisions/0029-liquid-templates.md`.

## The folder

`LINTEL_TEMPLATES` (default `site`, relative to the repository root):

```text
site/templates/<collection>.liquid   a collection's template; others can be chosen per page
site/layouts/*.liquid                for {% layout %}
site/partials/*.liquid               for {% render %} and {% include %}
```

## How a page is drawn

1. `renderEntry` (website/site-pages.service.ts) asks `LiquidTemplates.findTemplateForEntry`
   which template the entry uses: its `_template` choice (published values, or the draft's
   in preview), else `templates/<collection>.liquid`, else none. "designed" means none.
2. `renderEntryWithLiquid` (liquid-pages.service.ts) draws it with the globals `entry`,
   `site`, `menus`, `globals`, `request` and `lintel` (through which the tags reach the page).
3. A fragment goes inside the shared document; a whole document (`<!DOCTYPE` or `<html` first)
   gets the page's `<head>` where `{% lintel_head %}` is. The head comes from
   `renderDocumentParts` in `@lintel/site-components/server`, with the styles and scripts of
   every design and form drawn on the page.
4. The response goes into the rendered-pages cache like any other page.

## Files

| File                             | What it does                                                     |
| -------------------------------- | ---------------------------------------------------------------- |
| `liquid-templates.routes.ts`     | `GET /website/liquid-templates` (entries:read), for the editor   |
| `liquid-templates.service.ts`    | `LiquidTemplates`: the list, the choice, the engine, the watcher |
| `liquid-templates.schema.ts`     | The list the route answers with                                  |
| `templates-folder.repository.ts` | Reading the folder for the templates there are                   |
| `template-choice.ts`             | The `_template` key: reading it, keeping it through the checks   |
| `template-choice.repository.ts`  | Reading an entry's stored choice                                 |
| `liquid-engine.ts`               | LiquidJS, set up strictly                                        |
| `liquid-tags.ts`                 | `image`, `menu`, `form`, `design`, the document parts, filters   |
| `liquid-page-helpers.ts`         | What the tags need from the page, found through `lintel`         |
| `liquid-pages.service.ts`        | An entry's page drawn with its template                          |

## Rules

- Everything printed is escaped; tags escape every value they put in their HTML.
- Files are read only from the three folders (`relativeReference: false`, and LiquidJS
  checks real paths).
- `server.website.liquidTemplates` is null when `buildServer` isn't given a folder (tests,
  and installs built without `main.ts`). `main.ts` always gives one; a folder that doesn't
  exist means no templates.
- In development (`NODE_ENV=development`) the folder is watched: a change makes a new engine
  and empties the rendered pages. Template errors show on the page there, and are a plain 500
  page (with the error in the log) everywhere else.
