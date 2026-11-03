---
title: Moving from WordPress
description: Bringing a WordPress site's posts, pages, menus, custom fields, images, authors and WooCommerce products into Lintel.
since: "0.1"
sidebar:
  label: Moving from WordPress
---

Lintel can bring in a WordPress site's posts, pages (with their parent pages), categories,
tags, images, authors, menus, custom fields (such as those made with Advanced Custom
Fields) and, if you run a shop, WooCommerce products. The WordPress site isn't changed, and you can check everything
with a dry run before anything is imported.

## 1. Export from WordPress

In the WordPress admin, go to **Tools → Export**, choose **All content** and press
**Download Export File**. You get an `.xml` file.

If the WordPress site is offline, or its images aren't reachable from the internet, also
make a zip of its `wp-content` folder (or just `wp-content/uploads`). Lintel can take the
images from there instead of downloading them.

## 2. Upload the export

In Lintel, go to **Build → Import** and choose **WordPress** under **Move your site to
Lintel**. Choose the `.xml` file,
and the zip if you have one, then press **Read the file**. Lintel counts what is in the
export and lists anything it doesn't bring in, such as comments.

## 3. Choose where things go

Lintel suggests a place for everything, so for most sites you can keep its choices:

- **Posts go into** and **Pages go into**: which collection each lands in. Pages keep
  their parent pages.
- **Categories go into** and **Tags go into**: which taxonomy each lands in.
- **Images**: download them from the old site, take them from the uploaded zip, or leave
  them out. Lintel only downloads from the old site's own address. If the old site kept
  its images somewhere else, such as a CDN, add that address under **Other addresses
  images may come from**.
- **Authors**: add them as people in Lintel, or not. People are added without a
  password; WordPress passwords are never copied. Each sets their own before signing in.
- **Drafts**: bring drafts in as drafts, or leave them behind.
- **Shop products (WooCommerce)**: bring them into the shop, or leave them behind. The shop
  has to be switched on (Build → Features) and have a market, because prices need a
  currency. Simple and variable products come in with their options (from attributes),
  variations, SKUs, prices (a sale price becomes the price, the regular price the "compare
  at" price), weights and stock. Grouped and external products are listed as left out.
- **Bring in the menus**: each WordPress menu becomes a menu here, with the same links,
  order and nesting. Links to pages and posts follow them to their new addresses. Links to
  category archives are left out.
- **Suggest redirects from the old addresses**: each published post and page gets a
  suggested redirect from its WordPress address to its new one, so old links keep working.

Under the choices, Lintel shows which field each part of a post or page goes into (the
content, excerpt, featured image, categories and tags), based on the content type.

### Custom fields

If your posts or pages have custom fields, from Advanced Custom Fields or another plugin,
they're listed with an example of each, and those made with Advanced Custom Fields are
marked. Choose the field of the content type each one goes into, or leave it out. Lintel
suggests the field with the same name, so add fields to the content type first (in
**Content types**) if you'd like them all to come across. Values are read the way the
field needs: dates, numbers, on/off switches, images (by the attachment they point at)
and lists. A value the field can't take is left out and listed in the report; the rest of
the post still comes in.

## 4. Check with a dry run

Press **Check with a dry run**. Lintel goes through the whole import without saving
anything and shows what it would do: how many of each thing it would bring in, who would
be added, which posts have content it would keep as HTML, and any problems, such as an
image it couldn't reach. Images are checked but not downloaded.

Change the choices and run it again until you're happy.

## 5. Import

Press **Start import**. You can leave the page; the import carries on, and the progress is
shown when you come back.

If the import stops part way (the server restarted, say), it shows as **Paused**.
Everything brought in so far is kept. Press **Resume import** to carry on where it
stopped; nothing is brought in twice.

## The report

When the import finishes, Lintel shows:

- How many posts, pages, files, authors, categories and tags were imported, left out,
  or had problems.
- **People added**, who need to set a password before they can sign in.
- **Kept as HTML blocks**: WordPress blocks and shortcodes that Lintel's text editor has
  no equivalent for, such as embeds and galleries, with the pages they're on. Nothing is
  thrown away: they're kept as HTML blocks in the text, for you to check and replace if
  you like.
- **Addresses that had to change**, when a page's address was already taken.
- How many redirects were suggested. Review and accept them in **Settings → SEO tools →
  Redirects**.
- **Problems**, such as an image that couldn't be downloaded, and why.

Text, headings, lists, links, quotes and code come across as normal text. Images inside
text are brought into the media library and kept in place as HTML blocks.

## Good to know

- Importing the same site again doesn't make copies: posts and pages an earlier import
  brought in are left as they are, and images, people, categories and tags already here
  are reused. New posts since the last import are added.
- Removing an import from the list doesn't remove what it imported.
- Comments, widgets, plugins' settings and themes aren't imported. Category hierarchies
  come in flat, as taxonomies in Lintel have no parent terms.
- Imported authors join with the **Author** role and no password; they choose one with
  **Forgot your password?** on the sign-in screen.
- From the terminal: `pnpm lintel import wordpress export.xml [wp-content.zip] [--dry-run]`
  does the same with the suggested choices.
