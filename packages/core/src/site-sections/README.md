# site-sections

A site's navigation and footer, made in the page builder and shown on every page of that
site. The reasoning is in docs/decisions/0039-navigation-and-footer-sections.md.

- `site-sections.routes.ts`: `GET /website/sections` and `PUT /website/sections` for the
  site being edited. A PUT names only the slots it changes; null takes one off the site.
  Changing them needs `builder:blocks`, like a block, and code in them needs `builder:code`.
- `site-sections.service.ts`: reading (an unreadable section counts as none), changing
  (checked as pages are, with the site's rule for scripts), and the starter navigation and
  footer that setup and starter templates give a site that has never had any.
- `site-sections.repository.ts`: one `siteSections:<site id>` row in the settings table.

A site with no row, or no navigation in it, keeps the website's automatic header (the same
for the footer), so older sites look the same until they add one. The website draws them in
`website/site-sections-drawing.ts`; a page's design may hide them (`hideSiteNavigation`,
`hideSiteFooter`) or bring its own header, and then it gets neither.
