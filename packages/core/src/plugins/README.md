# Plugins

Features that are switched on only when a site needs them, so a new user isn't shown
everything at once. The "What are you building?" setup step picks the first set; they can
be changed later from the admin.

This is the start of Lintel's plugin system. Today a plugin is only an entry in a list
that can be switched on or off; the admin reads the list to show or hide its sections.
Later each entry in `plugins.registry.ts` will also register its own routes, tables and
admin screens, and that file stays the one visible place where plugins are listed.

## Endpoints

| Method and path | Permission        | Body                | Success                                                 |
| --------------- | ----------------- | ------------------- | ------------------------------------------------------- |
| `GET /plugins`  | `settings:read`   | none                | 200 `{ plugins: [{ id, name, description, enabled }] }` |
| `PUT /plugins`  | `settings:update` | `{ enabled: [id] }` | 200, the same shape as `GET`; 400 for an unknown id     |

`PUT` switches on exactly the plugins listed and switches off the rest.
`GET /auth/me` (and the sign-in and setup responses) also carry `enabledPlugins`, so the
admin can show the right sections without an extra request.

## The plugins

| id         | Name        | Adds admin sections                                               |
| ---------- | ----------- | ----------------------------------------------------------------- |
| `blog`     | Blog        |                                                                   |
| `commerce` | Online shop | `/commerce`                                                       |
| `forms`    | Forms       | `/forms`                                                          |
| `seo`      | SEO tools   | Settings → Search engines; the editor's SEO panel (see `src/seo`) |

Which ones are on is stored per tenant in the `enabledPlugins` setting (see `src/settings`).

## Content that comes with a plugin

When a plugin is switched on, `setEnabledPlugins` makes sure its content exists, from the
`contentForPlugins` list in `plugins.service.ts`. Today that is the blog's **Blog posts**
collection (see `src/collections/default-collections.ts`). It only creates what is missing,
and switching the plugin off deletes nothing, so posts survive being toggled.

## Files

| File                  | What it does                                         |
| --------------------- | ---------------------------------------------------- |
| `plugins.registry.ts` | The list of plugins: id, name, description, sections |
| `plugins.schema.ts`   | Zod schemas for requests and responses               |
| `plugins.service.ts`  | Listing plugins, and switching them on and off       |
| `plugins.routes.ts`   | The two endpoints                                    |
