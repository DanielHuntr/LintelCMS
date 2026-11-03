# site-sections

A site's navigation and footer, made in the page builder and shown on every page of that
site. The reasoning is in docs/decisions/0039-navigation-and-footer-sections.md.

- `site-sections.routes.ts`: `GET /website/sections` and `PUT /website/sections` for the
  site being edited. A PUT names only the slots it changes; null takes one off the site.
  Changing them needs `builder:blocks`, like a block, and code in them needs `builder:code`.
- `site-sections.service.ts`: reading (an unreadable section counts as none), changing
  (checked as pages are, with the site's rule for scripts), and the starter navigation and
  footer that setup and starter templates give a site that has never had any.
- `POST /website/sections/restore-previous` (`builder:blocks`): brings back the navigation
  and footer a starter template replaced. A template only replaces them when its look is
  applied, none of the site's pages stay (it replaces them, or there are none) and the
  person may change blocks; beside the site's own pages it never touches them. The ones it
  replaced are kept in a `siteSectionsBeforeTemplate:<site id>` row, and restoring swaps the
  two, so it can be undone the same way.
- Changes wait for Publish (docs/decisions/0042-shared-sections-wait-for-publish.md): `GET`
  and `PUT` are the builder's draft, with `unpublished` saying it differs from the website;
  `POST /website/sections/publish` (`builder:blocks` and `entries:publish`) puts it live, and
  the page builder's Publish sends one. The website and Liquid read the published sections
  (`readSiteSections`).
- `site-sections.repository.ts`: the `siteSections:<site id>` row in the settings table (what
  the website shows), `siteSectionsDraft:<site id>` (changes waiting) and
  `siteSectionsBeforeTemplate:<site id>` (what a starter template replaced).

A site with no row, or no navigation in it, keeps the website's automatic header (the same
for the footer), so older sites look the same until they add one. The website draws them in
`website/site-sections-drawing.ts`; a page's design may hide them (`hideSiteNavigation`,
`hideSiteFooter`) or bring its own header, and then it gets neither.
