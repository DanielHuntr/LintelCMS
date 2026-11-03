# Site sections

A site's navigation and footer: two sections stored once for the whole site and shown on
every page, in the same place. Editing one on any page edits it everywhere. The reasoning is
in docs/decisions/0039-navigation-and-footer-sections.md.

- `site-sections.ts`: the shape (`SiteSections`, one `PageNode` or null per slot), the
  fixed ids they have inside a page being edited (`site-navigation`, `site-footer`), and:
  - `withSiteSections` puts them into a page for the builder (hidden where the page hides
    them or has its own header or footer) and `splitSiteSections` takes them out again, so
    pages never keep a copy;
  - the page's own switches, `hideSiteNavigation` and `hideSiteFooter` on the page node
    (`isHiddenOnPage`, `withHiddenOnPage`);
  - `asSiteSection` makes any section one of them (its id, and the `<header>` or `<footer>`
    element);
  - `siteSectionsPage` draws them apart from a page for the website, with layer names that
    start with "Site" so their class names never meet the page's;
  - `unmarkedOwnNavigation` finds a first section that is really the page's own menu, so the
    builder can offer to mark it.

The ready-made Navigation and Footer layouts are in `src/sections/site-navigation.ts` and
`src/templates/navigation-sections.ts`. The Site logo element is in
`src/components/site-navigation-components.ts`.
