# Starter sites

"Start from a template" on the server: `POST /starter-sites/:id/apply` makes one page in
Pages for each page of a starter site (the templates are plain data in
`@lintel/builder-model`, `src/starter-sites`). Each page gets its title, summary and design
through the entries service, so it is checked and gets a revision like any other save.

| Method and path                 | Permission       | Body / success                                 |
| ------------------------------- | ---------------- | ---------------------------------------------- |
| `POST /starter-sites/:id/apply` | `entries:create` | `{ useTheme?, publish? }` → 201 the pages made |

As far as the person is allowed, it also:

- gives the website the template's colours, fonts and corners (`useTheme`, default on,
  needs `settings:update`);
- publishes the pages (`publish`, default off, needs `entries:publish`), announcing each as
  `entry.published` so webhooks and the website's cache follow;
- fills the main menu with a link to each page, if the menu is empty (`navigation:update`).

Nothing that exists is changed: a page whose address is in use gets the next free one
(`menu-2`), and the response says which. There is no repository; everything is done
through the entries, navigation and website services.

| File                       | What it does                                     |
| -------------------------- | ------------------------------------------------ |
| `starter-sites.routes.ts`  | The endpoint                                     |
| `starter-sites.service.ts` | Making the pages, the theme and the menu         |
| `starter-sites.schema.ts`  | The request and response                         |
| `starter-sites.errors.ts`  | An unknown template                              |
| `starter-sites.test.ts`    | Applying templates, permissions, taken addresses |
