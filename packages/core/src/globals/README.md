# Globals

Global sets: groups of fields with one value each for the whole site, such as "Site
settings" (site name, footer text, contact email, social links). Every site gets that set
during setup (`default-globals.ts`); more can be made in the admin.

A set's fields are kept on the set itself, in the same shape as a blueprint's, and checked
by the same fieldtypes. Unlike a content type there is no title field. Values are checked
like an entry's and go live as soon as they are saved: there are no drafts or revisions.

## Languages

Values are kept per locale (one `global_values` row per set and locale). A locale with
nothing saved shows the main language's values (`hasOwnValues: false`), and is delivered
with them; saving it for the first time starts from them, so only what needs translating
has to change. See `docs/decisions/0007-translations-as-linked-entries.md`.

## Endpoints

| Method and path                 | Permission          | Success                                     |
| ------------------------------- | ------------------- | ------------------------------------------- |
| `GET /globals`                  | `globals:read`      | 200 `{ globals: [GlobalSetSummary] }`       |
| `POST /globals`                 | `blueprints:update` | 201 `GlobalSet`                             |
| `GET /globals/:handle?locale=`  | `globals:read`      | 200 `GlobalSet`                             |
| `PUT /globals/:handle`          | `blueprints:update` | 200 `GlobalSet`, from `{ name, fields }`    |
| `PATCH /globals/:handle/values` | `globals:update`    | 200 `GlobalSet`, from `{ data }`            |
| `DELETE /globals/:handle`       | `blueprints:update` | 204                                         |
| `GET /delivery/globals?locale=` | public              | 200 `{ locale, globals: { handle: data } }` |
| `GET /delivery/globals/:handle` | public              | 200 `{ handle, name, locale, data }`        |

Changing a set's fields needs the same permission as changing a content type; changing
its values needs `globals:update`. `PATCH .../values` merges `data` over the saved values,
like an entry's. `GlobalSet` is the summary plus `fields`, `locale`, `data` and
`hasOwnValues`. Delivered values are expanded like an entry's (images, rich text,
markdown, terms, entries).

## Files

| File                          | What it does                                     |
| ----------------------------- | ------------------------------------------------ |
| `globals.table.ts`            | The `global_sets` and `global_values` tables     |
| `globals.schema.ts`           | Zod schemas for requests and responses           |
| `globals.service.ts`          | Sets, fields and values, with the language rules |
| `globals-delivery.service.ts` | The public endpoints                             |
| `global-references.ts`        | Taking deleted terms and entries out of values   |
| `global-sets.repository.ts`   | Database reads and writes for sets               |
| `global-values.repository.ts` | Database reads and writes for values             |
| `default-globals.ts`          | Site settings, made during setup                 |
| `globals.errors.ts`           | Named errors with the messages people see        |
| `globals.routes.ts`           | The endpoints                                    |
