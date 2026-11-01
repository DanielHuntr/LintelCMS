# 12. Plugins are trusted packages, built into the server and the admin

Date: 2026-11-01

## Decision

A plugin is a package with two halves that share an id:

- **`./server`** exports `definePlugin({...})` from `@lintel/core/plugin`: permissions,
  settings (a Zod schema and defaults), Drizzle tables with their own migrations folder,
  API routes, fieldtypes, and content to create when it is switched on.
- **`./admin`** exports `defineAdminPlugin({...})` from `@lintel/admin/plugin`: sidebar
  items, screens, Settings rows, dashboard widgets, section tabs, entry editor panels and
  field editors, as ordinary React components.

Lintel's own optional features (blog, forms, SEO, and the online shop later) are written
the same way and listed in `packages/core/src/plugins/plugins.registry.ts` and
`packages/admin/src/plugins/adminPlugins.ts`. Other plugins are npm or workspace packages
listed in `lintel.config.ts` at the repository root. The server imports their `./server`
when it starts; the admin build turns the same list into a module of imports
(`virtual:lintel-plugins`, written by `packages/admin/vite-plugin-lintel.ts`).

Installed plugins are **trusted code**. They run in the API process with the same
database access as Lintel itself, and their admin code runs in the admin with the
signed-in person's session. Lintel checks that a plugin's ids, permissions, tables and
fieldtypes stay inside its own name, and switches its routes off while it is disabled, but
it does not sandbox it.

### Lifecycle

| Step          | What happens                                                                                                                             |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Install**   | `pnpm add -w <package>`, add it to `lintel.config.ts`, restart. Its migrations run on start; it appears in Settings → Features, off.     |
| **Enable**    | Switched on in Settings → Features (or at setup). `createContent` runs; routes, screens, widgets and panels appear.                      |
| **Disable**   | Switched off. Routes answer 404 `PLUGIN_NOT_ENABLED`; admin contributions disappear. Tables, settings, content and layouts are kept.     |
| **Uninstall** | Removed from `lintel.config.ts` and the root `package.json`. It disappears; its tables and saved settings stay until someone drops them. |

## Why

- **Type-safe plugins.** Admin contributions are real React components imported at build
  time, so TypeScript checks them against the same types Lintel's own screens use, and the
  bundler gives them the admin's single copy of React, the router and the query cache.
  Loading plugin bundles at runtime would need a stable ABI for all of those, which we
  can't promise during the beta.
- **One visible list.** CONTRIBUTING asks for no discovery by naming convention. Both the
  built-in lists and `lintel.config.ts` are files a developer reads top to bottom.
- **Disable keeps data.** Non-technical people switch features off to tidy the admin, not
  to delete work. Making deletion a separate, deliberate step (dropping the tables) means
  a mis-click never loses bookings or posts.
- **Separate migration records.** Each plugin's applied migrations are recorded in their
  own table (`drizzle.__plugin_<id>_migrations`), so a plugin can be added, removed and
  re-added without confusing Lintel's own migration history.
- **Self-hosted first.** A Lintel site is deployed by the developer who chose its plugins,
  as with WordPress, Statamic or Strapi. A sandbox (separate processes, an RPC bridge, a
  permission manifest) would cost a lot of complexity before anyone needs it. If a
  marketplace of untrusted plugins comes later, it will need its own decision.

## Alternatives considered

- **Runtime plugin uploads** (a zip in the admin, loaded with `import()`): convenient, but
  every plugin would be untrusted code from the browser, and its admin half couldn't share
  the admin's React without a fragile global.
- **Discovering plugins from `node_modules`** by a keyword: no list to read, and installing
  a dependency of a dependency could switch on code nobody chose.
- **Plugins only on the server, with admin screens as JSON schemas**: safe, but too narrow
  for things like a booking calendar or an order screen.
