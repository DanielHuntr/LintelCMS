# Taxonomies

Ways of grouping content: Categories, Tags, Topics. A taxonomy has terms ("News",
"Guides"), and entries choose terms through a field of type `terms` (see
`src/fieldtypes/relation-fieldtypes.ts`), which stores a list of term ids.

Terms have a fixed set of fields: `title`, `slug` (unique in the taxonomy, made from the
title when left out, numbered when taken) and an optional `description`. Terms are
listed alphabetically.

The blog plugin starts every blog with Categories (News, Guides, Updates) and an empty
Tags taxonomy (`default-taxonomies.ts`); Blog posts have a field for each. It's safe to
run again: an existing taxonomy is left as it is, so deleted terms don't come back.

## Endpoints

| Method and path                          | Permission          | Success                                    |
| ---------------------------------------- | ------------------- | ------------------------------------------ |
| `GET /taxonomies`                        | `taxonomies:read`   | 200 `{ taxonomies: [Taxonomy] }`           |
| `GET /taxonomies/:handle`                | `taxonomies:read`   | 200 `Taxonomy`                             |
| `POST /taxonomies`                       | `taxonomies:update` | 201 `Taxonomy`, from `{ handle, name }`    |
| `PUT /taxonomies/:handle`                | `taxonomies:update` | 200 `Taxonomy`, from `{ name }`            |
| `DELETE /taxonomies/:handle`             | `taxonomies:update` | 204, or 409 `TAXONOMY_IN_USE`              |
| `GET /taxonomies/:handle/terms`          | `taxonomies:read`   | 200 `{ terms: [Term] }`                    |
| `POST /taxonomies/:handle/terms`         | `terms:update`      | 201 `Term`, from `{ title, slug?, ... }`   |
| `PATCH /terms/:id`                       | `terms:update`      | 200 `Term`                                 |
| `DELETE /terms/:id`                      | `terms:update`      | 204                                        |
| `GET /delivery/taxonomies/:handle`       | public              | 200 `{ handle, name, items: [Term] }`      |
| `GET /delivery/taxonomies/:handle/:slug` | public              | 200 `{ id, title, slug, description, ...}` |

`Taxonomy = { id, handle, name, termCount, updatedAt }`;
`Term = { id, taxonomyHandle, title, slug, description, updatedAt }`.

To list the entries with a term, ask the collection:
`GET /delivery/posts?taxonomy=tags&term=recipes`. Delivered terms fields become
`[{ id, title, slug, taxonomy }]`.

## Deleting

- A term: it is taken out of every entry and global set that chose it (saved and published
  values alike), so a deleted tag never stops someone saving an unrelated change.
- A taxonomy: refused while a content type or global set has a terms field for it (409
  `TAXONOMY_IN_USE`, with `usedBy`). Otherwise its terms go with it, taken out of entries
  the same way.

## Files

| File                             | What it does                                         |
| -------------------------------- | ---------------------------------------------------- |
| `taxonomies.table.ts`            | The `taxonomies` and `terms` tables                  |
| `taxonomies.schema.ts`           | Zod schemas for requests and responses               |
| `taxonomies.service.ts`          | Creating, renaming and deleting taxonomies; defaults |
| `terms.service.ts`               | Creating, editing and deleting terms; slugs          |
| `term-references.ts`             | Taking deleted terms out of entries and globals      |
| `taxonomies-delivery.service.ts` | The public endpoints                                 |
| `taxonomies.repository.ts`       | Database reads and writes for taxonomies             |
| `terms.repository.ts`            | Database reads and writes for terms                  |
| `default-taxonomies.ts`          | Categories and Tags for the blog plugin              |
| `taxonomies.errors.ts`           | Named errors with the messages people see            |
| `taxonomies.routes.ts`           | The endpoints                                        |
