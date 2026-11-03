# Templates

Design, Templates (`/design`): "Start from a template". The library lists every starter
site from `@lintel/builder-model` (`starterSites`) with its illustration (served by the
website), who it suits, its pages and colours. Choosing one asks two things, as far as the
person may: use the template's colours, fonts, menu and footer, and motion (`settings:update`), and publish the pages
straight away (`entries:publish`, off by default). The API makes the pages
(`POST /starter-sites/:id/apply`, see packages/core/src/starter-sites) and the screen then
links each page to the page builder.

On a site that has pages already, the dialog first asks what should happen to them (from
`GET /starter-sites/:id/existing-pages`): **Add them alongside** (the default: the site's home
page stays, the template's other pages go under it, and a page whose name is taken is added
as "About (2)") or **Replace my pages** (they go to the recycle bin; only for people who may
delete pages). Cancel changes nothing. A second home page is never made.

| File                      | What it is                                         |
| ------------------------- | -------------------------------------------------- |
| `TemplateLibraryPage.tsx` | The library, the "Start from …?" dialog and result |
| `StarterSiteCard.tsx`     | One template's card                                |
| `starter-sites.api.ts`    | The call that applies a template                   |

The setup wizard's last screen offers "Start from a template", which opens this page. Single
sections (heroes, prices, questions, footers…) are in the page builder's Insert panel.
