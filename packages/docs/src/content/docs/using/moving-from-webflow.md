---
title: Moving from Webflow
description: Bringing a Webflow site's CMS collections and pages into Lintel.
since: "1.0"
sidebar:
  label: Moving from Webflow
---

Lintel can bring in a Webflow site's CMS collections (blog posts, team members, anything
you keep in the CMS) and, as best it can, its pages. Nothing changes on Webflow, so you
can keep the old site running until the new one is ready.

## 1. Export from Webflow

- **Collections:** in the Webflow Designer, open the CMS, choose a collection and press
  **Export**. You get a `.csv` file. Do this for each collection.
- **Pages (optional):** open **Site settings → Export code** and download the zip. It has
  every page's HTML, the site's CSS and its pictures.

## 2. Upload

Go to **Settings → Import** and choose **Webflow**. Pick the CSV files (several at once is
fine) and the code export if you have it, then press **Read the files**. Lintel shows what
it found ("4 × Blog Posts, 12 pictures...") and, in plain words, what can't be moved.

## 3. Choose where things go

Each collection is shown with its fields. A CSV doesn't say what kind each field was, so
Lintel works it out from the values: on/off switches, numbers, pictures (several pictures
become a list of pictures), rich text, links, dates, colours and choices. For each
collection, choose:

- **Goes into**: a collection that's already here, or **a new content type** (the
  default), which Lintel makes with a field for each of Webflow's.
- For each field, the field it goes into, or **Don't import**.

The pages go into **Pages**, into its **Design** field. Under **Everything else** you
choose whether to bring in pictures and drafts (Webflow's drafts and archived items come
in as drafts) and whether to suggest redirects. Pictures are downloaded from Webflow's
picture servers; add any other address they're on.

## 4. Dry run, import and report

**Check with a dry run** shows exactly what would happen without changing anything.
**Start import** runs it in the background; you can leave the page. If it stops part way,
**Resume import** carries on where it stopped. The report lists what came in, what was
made, the designed pages to check, values that couldn't go into their field, and problems.

## Pages: what to expect

Each page comes in as a designed page made of **code blocks** that look like the original,
one for each part of the page (header, sections, footer), with the site's CSS. All the
text and pictures are marked as editable, so anyone can change them in the builder's
**Content panel** without touching code. Scripts are always taken out.

What doesn't come across: interactions and animations, forms, Webflow's e-commerce, and
collection template pages (the design each blog post is shown with). Rebuild those with
the builder's own elements; it's often a good moment to replace the code blocks too.

## Good to know

- Reference fields come in as text (the referenced item's slug).
- Old addresses (`/blog-posts/spring-sowing`) are kept where they can be; where an address
  changes, a redirect is suggested in **Settings → Redirects**.
- Importing the same files again doesn't make copies.
- From the terminal: `pnpm lintel import webflow posts.csv site.zip [--dry-run]`.
