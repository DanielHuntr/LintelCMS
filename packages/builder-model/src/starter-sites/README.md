# Starter sites

"Start from a template": whole small websites to begin from. Each starter site has a home
page and two or three others, original words and illustrations, a theme (colours, fonts and
corners) and gentle animations. Pages are built from the section library (`src/sections`),
so a template's sections are the same ones people can insert later.

| File                    | What it holds                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `starter-site.ts`       | The `StarterSite` shape and `buildStarterPage` (a page design)                                            |
| `starter-sites.ts`      | The list the template library shows, and `findStarterSite`                                                |
| `illustrations.ts`      | The flat SVG illustrations, served at `/_lintel/illustrations/`                                           |
| one file per site       | `bakery.ts`, `consultant.ts`, `portfolio.ts`, `magazine.ts`, ...                                          |
| `illustrations-<id>.ts` | A site's own pictures, added to `illustrations.ts` (`illustrations-folio.ts`, `illustrations-atelier.ts`) |

The server makes the pages (`packages/core/src/starter-sites`); the builder offers a single
starter page on an empty page. To add a starter site, write one file like `bakery.ts` and add
it to `starterSites`; the tests check every page against the standard components.

A starter site can also bring its own heading and body fonts (from the included fonts) and
its site-wide motion (`siteMotion`: smooth scrolling, the cursor, the page transition and the
first-visit intro); both are applied with its theme. Folio (`folio.ts`) and Atelier (`atelier.ts`) use both.

A starter site can bring its own navigation and footer (`siteSections`), shown on every page
of the site (see `site-sections/`) rather than repeated in each page. Studio, Atelier and
Folio do; the others get the standard Logo and menu navigation and Centred footer. Applying a
template with its look replaces the site's navigation and footer with the template's;
without the look, a site keeps the ones it has.
