# Templates

Design, Templates (`/design`): "Start from a template". The library lists every starter
site from `@lintel/builder-model` (`starterSites`) with its illustration (served by the
website), who it suits, its pages and colours. Choosing one asks two things, as far as the
person may: use the template's colours and fonts (`settings:update`), and publish the pages
straight away (`entries:publish`, off by default). The API makes the pages
(`POST /starter-sites/:id/apply`, see packages/core/src/starter-sites) and the screen then
links each page to the page builder.

| File                      | What it is                                         |
| ------------------------- | -------------------------------------------------- |
| `TemplateLibraryPage.tsx` | The library, the "Start from …?" dialog and result |
| `StarterSiteCard.tsx`     | One template's card                                |
| `starter-sites.api.ts`    | The call that applies a template                   |

The setup wizard's last screen offers "Start from a template", which opens this page. Single
sections (heroes, prices, questions, footers…) are in the page builder's Insert panel.
