---
title: Plugin API reference
description: Every option of definePlugin and defineAdminPlugin, and what the plugin packages export.
since: "0.1"
---

A plugin has a server half, `definePlugin` from `@lintel/core/plugin`, and an admin half,
`defineAdminPlugin` from `@lintel/admin/plugin`, with the same `id`. For a walk-through,
see [Writing a plugin](/building/writing-a-plugin/). The plugin system is in **beta**.

## definePlugin

```ts
import { definePlugin } from "@lintel/core/plugin";

export default definePlugin({ id: "bookings", name: "Bookings", description: "…" });
```

| Option          | Type                                 | What it does                                                                                       |
| --------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `id`            | `string`                             | Required. Lowercase letters, numbers and dashes, starting with a letter. Unique.                   |
| `name`          | `string`                             | Required. Shown in Build → Features and on the setup screen.                                       |
| `description`   | `string`                             | Required. One plain sentence about what it adds.                                                   |
| `version`       | `string`                             | Shown beside installed plugins in Build → Features.                                                |
| `permissions`   | `{ permission, description }[]`      | Permissions it adds. Each must start with `<id>:`, such as `bookings:read`.                        |
| `settings`      | `{ schema, defaults }`               | A Zod schema and the values used until an admin saves some. `defaults` must pass `schema`.         |
| `database`      | `{ tables, migrationsFolder }`       | Its Drizzle tables (named `<id>` or `<id>_…`) and the folder of migrations drizzle-kit wrote.      |
| `routes`        | `(server, { readSettings }) => void` | Adds its API routes. They answer 404 `PLUGIN_NOT_ENABLED` while it is off.                         |
| `fieldtypes`    | `Fieldtype[]`                        | Kinds of field for content types, made with `defineFieldtype`. Each `type` starts with `<id>.`.    |
| `createContent` | `(database) => Promise<void>`        | Makes what it needs (a collection, say) each time it is switched on. Must only add what's missing. |

Lintel checks these rules when the server starts and refuses to start with a message
naming the plugin and the problem, so a mistake never reaches someone using the admin.

### What @lintel/core/plugin exports

| Export                                                                   | For                                                  |
| ------------------------------------------------------------------------ | ---------------------------------------------------- |
| `definePlugin`, `PluginDefinition`, `PluginRouteContext`, `PluginServer` | Defining the plugin and typing its routes            |
| `id`, `tenantId`, `timestamps`, `DEFAULT_TENANT_ID`                      | The columns every Lintel table shares                |
| `Database`, `DatabaseOrTransaction`                                      | Typing repositories                                  |
| `requirePermission`, `requireSignedIn`, `getSignedIn`, `hasPermission`   | Guarding routes and reading who is signed in         |
| `parseRequest`, `HttpError`, `InvalidRequestError`, `InvalidFieldsError` | Checking requests and answering with readable errors |
| `defineFieldtype`, `Fieldtype`                                           | Fieldtypes                                           |
| `isPluginEnabled`, `requirePluginEnabled`, `PluginNotEnabledError`       | Code outside the plugin's routes that depends on it  |

`@lintel/core/plugin-testing` exports `startPluginTestServer({ plugins, enabled? })`,
which gives `{ server, database, signInWith(permissions), setEnabledPlugins(ids), close() }`.

### Settings

Lintel stores a plugin's settings for it and checks them with its schema:

| Request                     | Permission        | Body and answer                                       |
| --------------------------- | ----------------- | ----------------------------------------------------- |
| `GET /plugins/:id/settings` | `settings:read`   | the saved settings, or the defaults                   |
| `PUT /plugins/:id/settings` | `settings:update` | the whole settings object; 400 if it fails the schema |

Routes read them with `readSettings(server.database)`, typed from the schema. A saved
value that no longer fits the schema (after an update changed it) reads as the defaults.

## defineAdminPlugin

```tsx
import { defineAdminPlugin } from "@lintel/admin/plugin";

export default defineAdminPlugin({ id: "bookings", sidebarItems: [/* … */] });
```

Every contribution below can have a `permission`; people without it don't see it. None
of them show while the plugin is switched off. Labels are plain text: bring your own
words with `createTranslator`.

| Option             | Each item                                                                       | Where it shows                                                 |
| ------------------ | ------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `sidebarItems`     | `{ path, label, icon }`                                                         | The sidebar, after Media                                       |
| `screens`          | `{ path, component }`; `$name` in the path becomes `params.name`                | At that address in the admin                                   |
| `settingsRows`     | `{ group, label, description, icon, to }`                                       | The Settings screen, grouped under `group`                     |
| `dashboardWidgets` | `{ id, title, description, icon, component, defaultSize, onDefaultDashboard? }` | The widget gallery, and new dashboards if `onDefaultDashboard` |
| `dashboardTabs`    | `{ section, id, label, component }`; `section` is `"/"` or `"/content"`         | A tab beside the section's own screen                          |
| `editorPanels`     | `{ id, component }`, given `{ entryId, entryTitle, slug, collection }`          | The entry editor's side panel, above the history               |
| `fieldEditors`     | `{ type, Editor, labelling? }`, for a server fieldtype of the same `type`       | Wherever a field of that type is edited                        |

Icons come from `lucide-react`. Widgets receive `{ size }` (`"small"`, `"medium"` or
`"large"`), so they can show more when they have room. Field editors receive the same
props as Lintel's own (`field`, `value`, `onChange`, `controlId`, `describedBy`…) and
keep working while the plugin is off, so content that uses them stays editable.

### What @lintel/admin/plugin exports

| Export                                                                                                                                                                                                      | For                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `defineAdminPlugin` and the contribution types                                                                                                                                                              | Defining the admin half                   |
| `createTranslator`                                                                                                                                                                                          | The plugin's own words, with typed keys   |
| `PluginLink`, `PluginBackLink`, `usePluginNavigate`                                                                                                                                                         | Links and navigation to plugin screens    |
| `apiRequest`, `ApiError`, `describeError`, `LoadError`                                                                                                                                                      | Calling the API and showing failures      |
| `useSession`, `useCan`                                                                                                                                                                                      | Who is signed in, and what they may do    |
| `Button`, `Card`, `Dialog`, `ConfirmDialog`, `EmptyState`, `GroupedList`, `GroupedListRow`, `LargeTitle`, `LoadingRegion`, `SegmentedControl`, `Skeleton`, `TextField`, `Toggle`, `Badge`, `controlClasses` | Lintel's design system                    |
| `formatDateTime`, `formatRelativeTime`                                                                                                                                                                      | Dates as the rest of the admin shows them |

## lintel.config.ts

At the repository root. Lists the plugin packages to install, in the order their
contributions appear:

```ts
import type { LintelConfig } from "@lintel/core";

export default { plugins: ["@lintel/plugin-example-bookings"] } satisfies LintelConfig;
```

Each package must be a dependency of the repository root (`pnpm add -w <package>`) and
export `./server` and `./admin`. The API server reads the file when it starts; the admin
build turns it into a module of imports, so restart `pnpm dev` after changing it.

## The plugins endpoints

| Request        | Permission        | Body                | Answer                                                                                         |
| -------------- | ----------------- | ------------------- | ---------------------------------------------------------------------------------------------- |
| `GET /plugins` | `settings:read`   | none                | `{ plugins: [{ id, name, description, enabled, source, version, permissions, hasSettings }] }` |
| `PUT /plugins` | `settings:update` | `{ enabled: [id] }` | the same as `GET`                                                                              |

`source` is `"built-in"` or `"installed"`. `PUT` switches on exactly the plugins listed.
