# Starter sites

"Start from a template": whole small websites to begin from. Each starter site has a home
page and two or three others, original words and illustrations, a theme (colours, fonts and
corners) and gentle animations. Pages are built from the section library (`src/sections`),
so a template's sections are the same ones people can insert later.

| File               | What it holds                                                    |
| ------------------ | ---------------------------------------------------------------- |
| `starter-site.ts`  | The `StarterSite` shape and `buildStarterPage` (a page design)   |
| `starter-sites.ts` | The list the template library shows, and `findStarterSite`       |
| `illustrations.ts` | The flat SVG illustrations, served at `/_lintel/illustrations/`  |
| one file per site  | `bakery.ts`, `consultant.ts`, `portfolio.ts`, `magazine.ts`, ... |

The server makes the pages (`packages/core/src/starter-sites`); the builder offers a single
starter page on an empty page. To add a starter site, write one file like `bakery.ts` and add
it to `starterSites`; the tests check every page against the standard components.
