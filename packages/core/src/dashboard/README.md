# Dashboard

Each person's home dashboard: which widgets, in what order, at what size. The admin
draws it (see `packages/admin/src/dashboard`); this folder stores layouts and answers the
built-in widgets' questions.

## Layouts

A layout is a list of `{ widget, size }`: `widget` is an id such as `core:recent-edits` or
`bookings:today`, `size` is `small`, `medium` or `large`. The server only checks the shape
(each widget once, at most 40), because widgets are admin code and plugins come and go; a
widget whose plugin is off is kept in the list and simply not drawn.

`dashboard_layouts` holds a row per person who has saved one, and a row per role an admin
has set a default for (a check makes sure each row has exactly one of the two). What
someone sees is their own, else their role's (the first by role name), else nothing, and
the admin uses its built-in default. Deleting a user or role deletes their row.

## Endpoints

| Method and path                          | Permission        | Body                                                          |
| ---------------------------------------- | ----------------- | ------------------------------------------------------------- |
| `GET /dashboard/layout`                  | signed in         | none -> `{ widgets, source }`                                 |
| `PUT /dashboard/layout`                  | signed in         | `{ widgets }`                                                 |
| `DELETE /dashboard/layout`               | signed in         | none -> the layout now seen                                   |
| `GET /dashboard/role-layouts`            | `settings:update` | none -> `{ roles }`                                           |
| `PUT /dashboard/role-layouts/:roleId`    | `settings:update` | `{ widgets }`                                                 |
| `DELETE /dashboard/role-layouts/:roleId` | `settings:update` | none                                                          |
| `GET /dashboard/widgets/recent-edits`    | `entries:read`    | none -> `{ entries, total }`                                  |
| `GET /dashboard/widgets/needs-attention` | `entries:read`    | drafts and unpublished changes                                |
| `GET /dashboard/widgets/scheduled`       | `entries:read`    | scheduled entries, soonest first                              |
| `GET /dashboard/widgets/media-usage`     | `media:read`      | `{ fileCount, totalBytes, imageCount, imagesWithoutAltText }` |

## Files

| File                              | What it does                                    |
| --------------------------------- | ----------------------------------------------- |
| `dashboard.table.ts`              | The `dashboard_layouts` table                   |
| `dashboard.schema.ts`             | A layout's shape, and the responses             |
| `dashboard.service.ts`            | Whose layout someone sees; saving and resetting |
| `dashboard.repository.ts`         | Layout reads and writes                         |
| `dashboard-widgets.service.ts`    | The built-in widgets' data                      |
| `dashboard-widgets.repository.ts` | Their queries                                   |
| `dashboard-widgets.schema.ts`     | Their response shapes                           |
| `dashboard.routes.ts`             | The endpoints                                   |
