# Roles

A role is a named list of permissions ("Editor": `entries:*`, `media:*`, ...). A user can
have several roles; what they may do is all of those lists combined. The Users screen
gives each person one role.

## Built-in and custom roles

Every site has five built-in roles (`built-in-roles.ts`), made by `ensureBuiltInRoles`:

| Role   | What it can do                                                       |
| ------ | -------------------------------------------------------------------- |
| Owner  | Everything (`*`), including managing other owners                    |
| Admin  | Everything except changing owners                                    |
| Editor | All content, media, menus and tags; sees the content model           |
| Author | Sees all content; creates, edits, publishes and deletes only its own |
| Viewer | Sees content, media, menus and site-wide content; changes nothing    |

Their permissions are fixed (a new Lintel version can improve them); only "requires
two-factor" can be changed. Custom roles can hold any permission in the catalog.

## Permissions, in plain words

`permission-catalog.ts` lists every permission grouped by area with a name and a
description, which is what the role editor shows. Plugins add their own group from their
entry in `src/plugins/plugins.registry.ts` (the `permissions` list), and it appears while
the plugin is switched on.

"Own" permissions (`entries:update-own`, `entries:publish-own`, `entries:delete-own`)
allow the action only on entries the person created; see `src/entries/entry-access.ts`.

## Rules

- Nobody can give a role, or give a role a permission, that they don't have themselves.
  So only owners can make owners, and a role manager can't promote themselves.
- Built-in roles can't be renamed, changed or deleted. A role still given to someone
  can't be deleted.

## Endpoints

| Method and path     | Permission     | Body / success                                                 |
| ------------------- | -------------- | -------------------------------------------------------------- |
| `GET /roles`        | `users:read`   | 200 `{ roles: [{ id, name, ..., permissions, memberCount }] }` |
| `GET /permissions`  | `users:read`   | 200 `{ groups }`, the catalog for the role editor              |
| `POST /roles`       | `roles:update` | `{ name, description?, permissions, requiresTwoFactor? }` 201  |
| `PATCH /roles/:id`  | `roles:update` | any of the above                                               |
| `DELETE /roles/:id` | `roles:update` | 204; 409 while someone has it                                  |

## Files

| File                    | What it does                                                  |
| ----------------------- | ------------------------------------------------------------- |
| `permissions.ts`        | `hasPermission`: the one permission check, wildcards included |
| `permission-catalog.ts` | Every permission in plain words, plus plugin permissions      |
| `built-in-roles.ts`     | Owner, Admin, Editor, Author and Viewer                       |
| `roles.table.ts`        | The `roles` and `user_roles` tables                           |
| `roles.schema.ts`       | Request and response schemas                                  |
| `roles.service.ts`      | Listing, creating, changing and deleting roles; who can grant |
| `roles.repository.ts`   | Database reads and writes                                     |
| `roles.routes.ts`       | The endpoints                                                 |
| `roles.errors.ts`       | Named errors with the messages people see                     |

Routes don't call `hasPermission` themselves; they use `requirePermission` from
`src/auth/require-permission.ts`, which also handles "not signed in".

Features may check permissions of their own. `builder:code` lets someone write code in the
page builder (code blocks and Developer mode); see src/pages.
