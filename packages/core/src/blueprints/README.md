# Blueprints

A blueprint (shown to editors as a "content type") is the list of fields a kind of content
has. It is data, so people build them in the admin's blueprint builder. Fields and their
types are described in `src/fieldtypes`.

## Endpoints

| Method and path              | Permission          | Body                       | Success                                    |
| ---------------------------- | ------------------- | -------------------------- | ------------------------------------------ |
| `GET /blueprints`            | `blueprints:read`   | none                       | 200 `{ blueprints: [Blueprint] }`, by name |
| `GET /blueprints/:handle`    | `blueprints:read`   | none                       | 200 `Blueprint`                            |
| `POST /blueprints`           | `blueprints:update` | `{ handle, name, fields }` | 201 `Blueprint`                            |
| `PUT /blueprints/:handle`    | `blueprints:update` | `{ name, fields }`         | 200 `Blueprint`, with `version` one higher |
| `DELETE /blueprints/:handle` | `blueprints:update` | none                       | 204                                        |

`Blueprint = { id, handle, name, kind: "entry", fields, version, updatedAt }`

## Rules

- Handles (of blueprints and of fields) use lowercase letters, numbers and underscores,
  and start with a letter. A blueprint's handle can't change once made.
- Every blueprint starts with a Text field with the handle `title`. It is always required
  (whatever `required` says) and can be relabelled, but not removed or moved.
- Field handles are unique, and each field's options must suit its type.
- Field problems come back as 400 `INVALID_REQUEST` with `fields`, keyed by the field's
  handle (or `"field 3"` for a field sent without one), all at once.
- Every `PUT` bumps `version`. Entries keep their values when fields change; values of
  removed fields are dropped the next time each entry is saved.

## Errors

| Status | `code`                   | When                                     |
| ------ | ------------------------ | ---------------------------------------- |
| 400    | `INVALID_REQUEST`        | A field or the name is wrong (`fields`)  |
| 404    | `NOT_FOUND`              | No blueprint has that handle             |
| 409    | `BLUEPRINT_HANDLE_TAKEN` | Creating a handle that is already in use |
| 409    | `BLUEPRINT_IN_USE`       | Deleting one a collection still uses     |

## Files

| File                       | What it does                                             |
| -------------------------- | -------------------------------------------------------- |
| `blueprints.table.ts`      | The `blueprints` table                                   |
| `blueprints.schema.ts`     | Zod schemas for requests and responses                   |
| `blueprint-fields.ts`      | Checking a field list: each field, unique handles, title |
| `blueprints.service.ts`    | CRUD, and `ensureBlueprint` for default content          |
| `blueprints.repository.ts` | Database reads and writes                                |
| `blueprints.errors.ts`     | Named errors with the messages people see                |
| `blueprints.routes.ts`     | The endpoints                                            |
