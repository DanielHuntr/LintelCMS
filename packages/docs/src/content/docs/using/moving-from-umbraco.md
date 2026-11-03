---
title: Moving from Umbraco
description: Bringing an Umbraco site's document types, content tree, media and dictionary items into Lintel.
since: "1.0"
sidebar:
  label: Moving from Umbraco
---

Lintel can bring in an Umbraco site's document types (as content types), its content tree
(keeping every node's parent and sort order), media and dictionary items.

## 1. Export from Umbraco

Either:

- **uSync** (recommended): with uSync installed, go to **Settings → uSync** and choose
  **Export**. Zip the `uSync` folder, and add a copy of the site's `media` folder (usually
  `wwwroot/media`) to the zip so the pictures come too.
- **The Content Delivery API**: save the answer of
  `/umbraco/delivery/api/v2/content?take=1000` as a `.json` file. It has published content
  only, and no document type settings, so fields are worked out from the values.

## 2. Upload and choose where things go

Go to **Build → Import**, choose **Umbraco**, pick the zip (or the JSON file) and press
**Read the files**. Each document type used by the content is shown with its properties,
which map to fields by their editor: text box, text area, rich text, Markdown, numbers,
true/false, date, media and content pickers, email, colour, tags and lists, dropdowns and
URL pickers.

Each document type becomes a content type whose pages may sit under the types Umbraco
allowed, so the tree stays as it was: the home page at the top, its pages under it.
Dictionary items become a **Dictionary** global set, one text field each.

Then **Check with a dry run**, **Start import**, and read the report.

## Good to know

- Umbraco's first page at the top is the site's "/", as it is here, so most addresses stay
  the same. Where one changes, a redirect is suggested in **Settings → Redirects**.
- Block List, Block Grid, Nested Content and the old Grid are left out and listed.
- Templates (Razor views), members, forms and other languages than the default don't come
  across.
- From the terminal: `pnpm lintel import umbraco usync.zip [--dry-run]`, or give the
  Delivery API's address.
