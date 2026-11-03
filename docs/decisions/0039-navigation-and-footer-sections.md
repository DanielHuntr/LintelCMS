# 39. Navigation and footer are sections people add once, shown on every page

Date: 2026-11-03

## Decision

A site's navigation and footer are sections people add, not something the website bolts on.

- **Insert → Sections** has a **Navigation** group (five layouts: logo and menu, centred
  logo, menu and button, over the first section, logo and Menu button) and a **Footer**
  group (five layouts). Their links follow one of the site's menus (Content → Menus, the
  main menu to start with), with "Which menu" on the menu element. On tablets and phones
  the menu folds into a Menu button that opens a drawer (a `<dialog>`, so focus stays in
  it and Escape closes it). A new **Site logo** element shows the site's logo or name,
  linking home.
- **Added once, shown everywhere.** A section from either group goes into the site's own
  slot: one navigation and one footer per site. Editing it on any page edits it on every
  page. On the canvas it says "Navigation · on every page".
- **Hide on this page.** From the strip above the canvas, from Layers, or from the page's
  switches (the Content tab with nothing selected). Deleting it on a page hides it there.
- **Any section can become one**: "Use as the site's navigation" or "…footer" under a
  top-level section. **"Use as this page's own navigation"** makes it the page's banner and
  hides the site's on that page. When a page's first section holds a menu or a row of links,
  the builder offers this, so a page never shows two navigations.

## Storage

Each site keeps its sections in one settings row (`siteSections:<site id>`), as page nodes.
Pages don't keep a copy: the builder puts them into the page it opens, under fixed ids
(`site-navigation`, `site-footer`), so they're selected, styled, animated and undone like
anything else, and takes them out before saving. A page keeps only whether it hides them
(`hideSiteNavigation`, `hideSiteFooter` on the page node). The builder sends a slot only
when it changed, so a page opened before another page added a navigation never takes it
away. No migration is needed.

Like the design system (0035), a change goes live at once on every page, without
publishing: it is the site's, not one page's. Changing them needs `builder:blocks`, as a
block does; code inside them needs `builder:code`, and the site's rule for scripts applies.

## On the website

The website draws them for each page, with the builder's renderer, the current page marked
in the menu, and layer names that start with "Site" so their class names never meet the
page's own. They go where the automatic header and footer went: outside `<main>`, after
the skip link, so they are the page's banner and content information landmarks. A page that
hides one, or has its own header or footer, gets neither that nor the automatic one. Pages
without a design (blog posts, lists, Liquid templates) get them too; `{% site_header %}` and
`{% site_footer %}` draw them when the site has them.

## Older sites, new sites

A site without a navigation section keeps the automatic header (and the same for the
footer), so nothing changes for a site until it adds one. Once it does, the automatic one is
gone on every page, and the builder says so in one line. A navigation taken off the site
(undoing the first one, or `navigation: null` through the API) brings the automatic one
back, so a site is never left without a menu. The builder offers Hide on this page and
replacing it, not removing it from every page, so nobody takes it away by accident.

Setup and starter templates give a site that has never had sections the "Logo and menu"
navigation and the "Centred footer", so nobody publishes a site with no menu. A template can
bring its own (Studio, Atelier and Folio do, in their own look); applied with its look, they
replace the site's, since they are part of it.

Links typed into the site's sections ("/work") are drawn with the site's path prefix and
language, as the menu's and the logo's are, so a site served under "/fr" keeps it. The Centred
footer has a Language switcher, which shows only on a site in more than one language, so
such sites keep the language links the automatic footer gave them.

## Not done

- A per-page choice of a different navigation (two shared navigations). One per site keeps
  it simple; a page that needs its own marks a section as its own.
- Drafts of the navigation. It's live at once, as the design system is.
