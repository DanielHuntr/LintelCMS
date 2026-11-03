---
title: Running several sites
description: Adding a second website, choosing what each site shares, and who works on which.
since: "0.1"
sidebar:
  label: Several sites
---

One Lintel can run several websites: a brand in a few countries, or a handful of small
brands. Each **site** has its own pages, menus, site settings and languages, while the
media library, content types and people are shared.

If you only have one site, nothing on this page changes anything for you. The site
switcher stays hidden until you add a second site.

## Adding a site

Go to **Build → Websites and domains** and press **Add a site**. Only the name is needed:

- **Name**: what editors see, such as "Acme France".
- **Handle**: a short code developers use for the site, such as `france`. It can't change
  later.
- **Domains**: where the site lives, such as `acme.fr, www.acme.fr`. You can paste a full
  address; Lintel keeps just the domain.
- **Path (optional)**: only when two sites share a domain. `/fr` puts the site at
  `acme.com/fr`.
- **Site address**: the full public address, such as `https://www.acme.fr`. The sitemap
  and previews use it.
- **Main language** and **Other languages**: what the site is written in.

A new site starts with empty copies of the main site's menus, ready to fill in. The site
you had before is marked **Main site**. It can't be deleted.

## Switching between sites

With more than one site, **Working on** appears at the top of the sidebar. Choose a site
there and every list and editor shows that site's content: entries, menus, site settings,
taxonomies and languages. Lintel remembers your choice next time you sign in.

## What each site has

Under **Content on each site** in Build → Websites and domains, choose for every collection:

- **Each site its own**: every site writes its own entries (the usual choice for pages and
  blog posts). Untick a site to leave the collection out of it.
- **Shared**: every site shows the same entries, such as a list of stores. Shared entries
  are edited while the main site is chosen.

Other things work like this:

- **Menus and site settings** belong to the site you're working on. Each site fills in
  the same settings, such as the footer, in its own way.
- **The site's look in the page builder** belongs to each site too: its
  [fonts](/using/fonts/), its [navigation and footer](/using/navigation-and-footer/), its
  [Site styles](/using/site-styles/) and its [motion across the site](/using/site-motion/).
  Changing the French site's brand colour leaves the English site alone. The theme, logo
  and cookie notice in **Settings → Your website** are shared by every site.
- **Taxonomies** can be used on every site, or on one. Choose under **Used on** when you
  add one.
- **Media** is one library every site can use. To keep things tidy, each site also has a
  folder: under **Folder** in the media library, choose **All files**, **Shared**, or the
  site you're working on. Uploads go into that site's folder while it is chosen, and into
  the shared library otherwise.

## Copying an entry to another site

In an entry's **⋯** menu, choose **Copy to site…** and pick the site. Lintel starts a draft
there with the same content, ready to adapt. Nothing goes live until you publish it on
that site, and changing one copy never changes the other.

Entries in shared collections can't be copied, since every site already shows them.

## Who works on which site

Under **Who works on which site**, each role can work on every site, or be kept to some.
Someone with several roles can work on every site any of their roles allows. People only
see the sites they may use in the switcher, and can't open another site's entries.

## Deleting a site

Press the bin next to a site. Its menus, site settings and languages are deleted too, and
files in its media folder move to the shared library. A site that still has entries can't
be deleted until they are moved or deleted.

For developers connecting websites to several sites, see
[multi-site for developers](/building/multisite/).
