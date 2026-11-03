# Plugins

Optional features, switched on only when a site needs them. A plugin is a
`definePlugin({...})` (`plugin-definition.ts`) that can add permissions, settings, its own
tables and migrations, API routes, fieldtypes, and content made when it is switched on.
Its admin half is a `defineAdminPlugin` in the admin (see `packages/admin/src/plugins`).
The beta, the trust model and the lifecycle are explained in
`docs/decisions/0012-plugins.md`; the developer guide is the docs page "Writing a plugin".

## Where plugins come from

- **Built in**: `plugins.registry.ts` lists Lintel's own, each defined in its feature
  folder (`src/blog`, `src/forms`, `src/seo`, `src/free-photos` and the others it lists).
- **Installed**: packages listed in `lintel.config.ts` at the repository root.
  `installed-plugins.ts` loads each one's `./server` when the API starts (main.ts), and
  `buildServer({ plugins })` adds them after the built-in ones.

`PluginCatalogue` (`plugin-catalogue.ts`) holds both, on `server.plugins`. It checks each
plugin when the server is built: a well-formed, unique id, and permissions, tables and
fieldtypes named after it. A mistake stops the server with a message naming the plugin.

## What Lintel does with a plugin

| Part            | Where it's handled                                                                                             |
| --------------- | -------------------------------------------------------------------------------------------------------------- |
| `routes`        | `plugin-routes.ts`: each plugin in its own Fastify scope that answers 404 `PLUGIN_NOT_ENABLED` while it is off |
| `database`      | Its migrations run on start and when setup switches database, recorded in `drizzle.__plugin_<id>_migrations`   |
| `settings`      | `plugin-settings.service.ts`: stored as the `plugin:<id>` setting, checked by its schema                       |
| `fieldtypes`    | Added to the fieldtype list (`src/fieldtypes`), and offered by `GET /fieldtypes` with the plugin's id          |
| `createContent` | Run by `setEnabledPlugins` each time the plugin is switched on                                                 |
| `permissions`   | Listed by `GET /plugins` for the roles screen                                                                  |

Which plugins are on is the `enabledPlugins` setting, per tenant. `GET /auth/me` carries
it, so the admin shows the right things without another request. Switching a plugin off
deletes nothing.

## Endpoints

| Method and path             | Permission        | Body                | Success                                                                                            |
| --------------------------- | ----------------- | ------------------- | -------------------------------------------------------------------------------------------------- |
| `GET /plugins`              | `settings:read`   | none                | 200 `{ plugins: [{ id, name, description, enabled, source, version, permissions, hasSettings }] }` |
| `PUT /plugins`              | `settings:update` | `{ enabled: [id] }` | 200, the same shape as `GET`; 400 for a plugin that isn't installed                                |
| `GET /plugins/:id/settings` | `settings:read`   | none                | 200, the settings or their defaults; 404 without settings                                          |
| `PUT /plugins/:id/settings` | `settings:update` | the settings        | 200, what was saved; 400 if they fail the plugin's schema                                          |

## For plugin authors

`plugin-api.ts` is `@lintel/core/plugin`: everything a plugin may import. `plugin-testing.ts`
is `@lintel/core/plugin-testing`: a real server with the plugin installed, for its tests.
`packages/plugin-example-bookings` is the reference plugin.

## Files

| File                         | What it does                                                    |
| ---------------------------- | --------------------------------------------------------------- |
| `plugin-definition.ts`       | `definePlugin` and the shape of a plugin and `lintel.config.ts` |
| `plugins.registry.ts`        | The built-in plugins, in one visible list                       |
| `installed-plugins.ts`       | Reading `lintel.config.ts` and loading the packages             |
| `plugin-catalogue.ts`        | Every plugin this server has, checked                           |
| `plugin-routes.ts`           | Registering plugins' routes behind the "switched on" check      |
| `plugins.service.ts`         | Listing plugins, and switching them on and off                  |
| `plugin-settings.service.ts` | Reading and saving a plugin's settings                          |
| `plugins.routes.ts`          | The endpoints                                                   |
| `plugins.schema.ts`          | Zod schemas for requests and responses                          |
| `plugins.errors.ts`          | Named errors                                                    |
| `plugin-api.ts`              | `@lintel/core/plugin`                                           |
| `plugin-testing.ts`          | `@lintel/core/plugin-testing`                                   |
