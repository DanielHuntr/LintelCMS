# 45. Each site has its own styles and motion

Date: 2026-11-03

It follows [0034](0034-site-motion.md), [0035](0035-editorial-layouts.md) and
[0039](0039-navigation-and-footer-sections.md).

## The problem

On an install with several sites, each site already had its own fonts and its own
navigation and footer. Its design variables, shared styles and tag styles (Site styles in
the page builder) and its motion (cursor, smooth scrolling, page transitions and the intro)
were still one setting for every site. Changing the French site's brand colour changed the
English site's too, and applying a template to one site gave its motion to all of them.

## Decision

**Styles and motion belong to a site.** They are kept in the settings table under
`siteDesign:<site id>` and `siteEffects:<site id>`, the way `siteSections:<site id>` is. No
new table and no migration: they are still one settings row each, just one per site.

**The site is the one being worked on.** `GET` and `PUT /website/design` and
`/website/effects` use the site the admin sends in the `Lintel-Site` header (or `?site=`),
like `/website/sections`, and check the person may work on it. The permissions are the same
as before: reading needs `entries:read`, changing styles needs `builder:blocks` and changing
motion needs `settings:update`. The website draws each site with its own, and applying a
template gives its motion and design variables to the site being edited only.

**The old shared row still counts.** A site with no row of its own reads the one `siteDesign`
or `siteEffects` row that existed before, so an existing install looks exactly the same after
the update. The first change saved for a site writes that site's own row, starting from what
it showed. Nothing is copied when it is read: reading never writes, and the old row is left
alone so going back a version still finds it.

A consequence: a site added later also starts from the old shared row, when there is one.
On an install that only ever had one site that is the main site's look, which is a sensible
starting point; the new site's first change makes it its own. A new install has no shared
row, so new sites start empty.

The website's theme, template and logo (Settings → Your website) are not part of this and
are still shared.
