---
title: Moving from Statamic
description: Bringing a Statamic site's collections, page tree, taxonomies, globals, navigation and assets into Lintel.
since: "1.0"
sidebar:
  label: Moving from Statamic
---

Statamic keeps content as files, so moving is a matter of zipping the right folders.
Lintel brings in collections and their entries, the page tree (with its order and
nesting), blueprints as content types (with their fields' types), taxonomies and terms,
globals, navigation and assets.

## 1. Make a zip

Zip the site's `content` folder together with `resources/blueprints` and the assets
folder (usually `public/assets`). Zipping the whole site folder works too: Lintel only
reads content, blueprints and assets.

## 2. Upload and choose where things go

Go to **Settings → Import**, choose **Statamic**, pick the zip and press **Read the files**.

Each collection is shown with its blueprint's fields. A collection with the same handle as
one here (such as `pages`) goes into it, its Markdown into the body; the others become new
content types. Fields map by type:

| Statamic                                | Lintel                    |
| --------------------------------------- | ------------------------- |
| text, textarea, markdown, code          | the same                  |
| bard, redactor                          | rich text                 |
| assets                                  | picture (or pictures)     |
| toggle, integer, float, date            | on/off, number, date      |
| select, radio, button group, checkboxes | choice                    |
| terms, entries                          | terms, links to entries   |
| link, color, list, video                | link, colour, list, video |

Replicator, grid, table and YAML fields have no equal here; they're listed as left out.

Then **Check with a dry run**, **Start import**, and read the report. Taxonomies are made
if they aren't here; globals become global sets; each navigation becomes a menu linking to
the entries that came in.

## Good to know

- Entry addresses come from each collection's route. Where an address changes (a route
  with the year in it, say), a redirect is suggested in **Settings → Redirects**.
- Bard's sets (blocks inside the text) are left out; the text around them comes in.
- Templates (Antlers or Blade), forms and users aren't content, so they don't come across.
- From the terminal: `pnpm lintel import statamic site.zip [--dry-run]`.
