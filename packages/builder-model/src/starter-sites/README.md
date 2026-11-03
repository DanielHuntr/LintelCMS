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
| `<id>.test.ts`          | A showcase site's own checks (`studio.test.ts`, `relay.test.ts`, `threshold.test.ts`, ...)                |
| `illustrations-<id>.ts` | A site's own pictures, added to `illustrations.ts` (`illustrations-folio.ts`, `illustrations-atelier.ts`) |

The server makes the pages (`packages/core/src/starter-sites`); the builder offers a single
starter page on an empty page. To add a starter site, write one file like `bakery.ts` and add
it to `starterSites`; the tests check every page against the standard components.

A starter site can also bring its own heading and body fonts (from the included fonts) and
its site-wide motion (`siteMotion`: smooth scrolling, the cursor, the page transition and the
first-visit intro); both are applied with its theme. Folio (`folio.ts`) and Atelier (`atelier.ts`) use both.

A starter site can bring its own navigation and footer (`siteSections`), shown on every page
of the site (see `site-sections/`) rather than repeated in each page. Studio, Atelier and
Folio do, as do Relay (a software product), Chambers (a law and accountancy practice),
Longplay (a band), Threshold (an estate and letting agent) and Longwave (a podcast); the
others get the standard Logo and menu navigation and Centred footer. Applying a
template with its look replaces the site's navigation and footer with the template's;
without the look, a site keeps the ones it has.

A starter site can bring collections its pages list (`collections`): Threshold's listings
and Longwave's episodes. Applying the template makes each one the site doesn't have yet, with
its sample entries (`packages/core/src/starter-sites/starter-collections.ts`); their entries
have no pages of their own, and a Collection list on the template's pages shows them, its
pictures and words bound to the entries' fields. A site that has the collection already
keeps it as it is. A newsletter sign-up in a template gets a working form too, like a form.
