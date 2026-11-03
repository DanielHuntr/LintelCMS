---
title: Moving from Framer
description: Bringing a Framer site's CMS collections into Lintel, and its pages as far as they can come.
since: "1.0"
sidebar:
  label: Moving from Framer
---

Lintel can bring in a Framer site's **CMS collections**. Framer has no way to export page
designs, so pages come across only as a best effort, and this page says plainly what
doesn't.

## 1. Export from Framer

In Framer's CMS, open a collection, open its menu and choose **Export CSV**. Do this for
each collection.

Optional: to bring pages in as a starting point, open each published page in your browser,
use **File → Save page as… (Web page, complete)**, and zip the saved files.

## 2. Upload and choose where things go

Go to **Build → Import** and choose **Framer**. Pick the CSV files (and the zip of saved
pages, if you made one) and press **Read the files**. Each collection is shown with its
fields, worked out from the values (text, rich text, pictures, switches, numbers, dates,
links, choices). Choose a collection here or let Lintel make a new content type, and the
field each old field goes into.

Then **Check with a dry run**, **Start import**, and read the report, as for the other
importers. An import that stops part way can be resumed.

## What can't be moved

- **Page designs.** Saved pages come in as code blocks with their text and pictures
  editable, but Framer draws much of a page with scripts, which never come across. Framer's
  components, effects, animations, scroll and hover interactions, and forms don't move.
  Rebuild pages with the builder; the imported copy is something to work from.
- **Collection page layouts** (the design each CMS item is shown with) aren't in the
  export. Design them in the builder.

## Good to know

- Pictures are downloaded from Framer's picture servers (`framerusercontent.com`).
- From the terminal: `pnpm lintel import framer recipes.csv [--dry-run]`.
