# 22. Pages at the top of the tree are site starts

Date: 2026-11-01

## Decision

A page at the top of a page tree (no parent, in a `tree` collection with a route pattern) is
a **site start**, as a root node is in Umbraco. Its own address is "/" and its children's
addresses carry no trace of it: "/about", not "/home/about". There can be several. The first
in the tree's order is "/", the others answer under their slug ("/shop", "/shop/boots"), and
"Hostnames" can give any of them a domain and/or a path prefix instead, kept in
`content_root_addresses`. The rules are pure functions in
`packages/core/src/content-roots/root-addresses.ts`.

Below a site start, addresses still come from route patterns. Every feature that shows an
address builds it as before and passes it through `placeEntryUrls`.

Moving a page changes the addresses of the live pages it takes with it (and, at the top,
possibly which site start is "/"). The move answers with those changes, announces
`entry.moved` for each (so the SEO tools suggest redirects, as for a changed slug), and the
admin offers "Add redirects", which turns them into working 301s.

## Why

Editors asked to create pages at the root rather than under a fixed "/home". Treating the
top of the tree as the site's start makes the tree read as the site does, gives several
sites in one tree a natural shape, and lines up with multisite (`src/sites` on the release
branch): sites are found by domain and prefix, then site starts within a site by the same
rules.

Keeping route patterns below a site start, rather than building addresses from every
ancestor's slug, keeps the promise of decision 18 that addresses don't follow parents
within a site, so moving a page between parents under the same site start never changes
its address, and delivery, GraphQL and content model files keep working as they were.

## Consequences

- An install with several pages at the top of Pages changes: the first is now "/" and the
  pages under the others gain their slug in front ("/about/team"). Moving them under the
  home page (and adding the redirects offered) restores the old addresses.
- The page with the slug "home" is no longer special unless it is first; the built-in
  website still falls back to it when there is no site start.
- Sorting the top of a section with Sort children can change which site start is "/"
  without offering redirects; dragging does offer them.
- A site start's Hostnames aren't kept in the recycle bin, so restoring one brings it back
  with the default address.
