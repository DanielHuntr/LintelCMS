# 7. Documentation with Astro Starlight, bundled into the admin's help

Date: 2026-11-01

## Decision

The documentation site is `packages/docs`, built with Astro Starlight from Markdown in the
repository. The admin's help panel imports the "Using Lintel" pages from the same files at
build time (`@lintel/docs/help`) and renders them itself, so there is one copy of every page.

## Why

We wanted docs that are static and fast, look as calm as the admin, and need no upkeep
beyond writing Markdown: a sidebar, search, dark mode, "Edit this page" links and a
version on every page.

Starlight gives all of that out of the box. Pages ship as plain HTML with almost no
JavaScript; search is a Pagefind index built with the site and searched in the browser,
so there is no search service to run or pay for; dark mode, keyboard navigation and skip
links are built in and accessible. It reads Markdown from the repository, so docs change
in the same pull request as the code they describe. Its components can be overridden one
at a time, which is how the version label and "Since" badges are added, and its colours
are CSS variables, so the admin's system font, accent and greys carry over in one file.

Keeping help in the same files means the help panel can't drift from the docs, and it
works offline because nothing is fetched at run time. "Using Lintel" pages stay plain
Markdown (no MDX components) so the admin can render them with `marked`.

## Versions

Rather than keep a copy of the docs per release, each page says which version introduced
it (`since`), shown beside its title, and the site shows the version it describes. Lintel
is young and moves forward together; when an old release needs its own docs, Starlight's
community versioning plugins can be added without moving any content.

## Alternatives considered

- **VitePress**: just as fast and polished, but built on Vue. Everything else in Lintel is
  React, so overriding its theme would mean learning a second component model.
- **Docusaurus**: React and mature, with versioning built in, but it ships a React app to
  every page and needs a search service (Algolia) or a plugin for local search.
- **Nextra**: React and MDX, but tied to Next.js and its build, which is more machinery
  than static docs need.
- **Docs inside the admin only**: no build step, but developers need docs before they have
  a running Lintel, and search engines can't see them.
