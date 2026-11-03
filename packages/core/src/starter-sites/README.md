# Starter sites

"Start from a template" on the server: `POST /starter-sites/:id/apply` makes one page in
Pages for each page of a starter site (the templates are plain data in
`@lintel/builder-model`, `src/starter-sites`). Each page gets its title, summary and design
through the entries service, so it is checked and gets a revision like any other save.

| Method and path                         | Permission       | Body / success                                                 |
| --------------------------------------- | ---------------- | -------------------------------------------------------------- |
| `GET /starter-sites/:id/existing-pages` | `entries:read`   | → `{ pageCount, hasHome, clashes }`                            |
| `POST /starter-sites/:id/apply`         | `entries:create` | `{ useTheme?, publish?, existingPages? }` → 201 the pages made |

As far as the person is allowed, it also:

- gives the website the template's colours, fonts and corners (`useTheme`, default on,
  needs `settings:update`);
- publishes the pages (`publish`, default off, needs `entries:publish`), announcing each as
  `entry.published` so webhooks and the website's cache follow;
- fills the main menu with a link to each page, if the menu is empty (`navigation:update`);
- makes the template's own collections with their sample entries (`collections`, such as
  Threshold's listings), when the site has none with that handle (`collections:update`),
  publishing the entries with the pages. The answer's `collectionsMade` names them;
- makes the forms its pages show (a contact form, a newsletter sign-up), named after the
  job they do, when Forms is on.

The template's home page starts the page tree and its other pages go under it ("/about").

A site that has pages already is never given a second home page silently. Applying answers
409 `SITE_HAS_PAGES` unless `existingPages` says what to do:

- `"replace"` (needs `entries:delete`): the site's pages go to the recycle bin, links to
  them leave the main menu, and the template's pages take their place;
- `"alongside"`: the site keeps its home page (the template's is skipped, `skippedHome`)
  and the template's other pages go under it; one whose address is taken gets the next
  free one and says so in its title ("About (2)" at "/about-2").

`existing-pages` tells the admin what it would meet, to ask in plain words. The only query
of its own is in `starter-sites.repository.ts`; the rest goes through the entries,
navigation, recycle bin and website services.

| File                          | What it does                                 |
| ----------------------------- | -------------------------------------------- |
| `starter-sites.routes.ts`     | The endpoint                                 |
| `starter-sites.service.ts`    | Making the pages, the theme and the menu     |
| `starter-collections.ts`      | The template's collections and their entries |
| `starter-sites.schema.ts`     | The request and response                     |
| `starter-sites.errors.ts`     | An unknown template; a site that has pages   |
| `starter-sites.repository.ts` | The pages a template would join              |
| `starter-sites.test.ts`       | Applying, replacing, alongside, permissions  |
