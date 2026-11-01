---
title: Plugins
description: How optional features are switched on and off, and where the plugin system is going.
since: "0.1"
---

Optional features are plugins, so a new site only shows what it needs. The setup screen's
"What are you building?" step switches the first set on.

## The plugins today

| id         | Name        | What switching it on does                           |
| ---------- | ----------- | --------------------------------------------------- |
| `blog`     | Blog        | Creates the **Blog posts** collection (`posts`)     |
| `commerce` | Online shop | Shows the Commerce section (screens on the roadmap) |
| `forms`    | Forms       | Shows the Forms section (screens on the roadmap)    |
| `seo`      | SEO tools   | Reserved for page titles, sitemaps and redirects    |

Switching a plugin off hides it but deletes nothing.

## The API

| Request        | Permission        | Body                | Response                                            |
| -------------- | ----------------- | ------------------- | --------------------------------------------------- |
| `GET /plugins` | `settings:read`   | none                | `{ plugins: [{ id, name, description, enabled }] }` |
| `PUT /plugins` | `settings:update` | `{ enabled: [id] }` | the same as `GET`                                   |

`PUT` switches on exactly the plugins listed and switches the rest off. `GET /auth/me`
includes `enabledPlugins`, which the admin uses to show or hide sections.

## Writing code that depends on a plugin

- **In the API**, call `findEnabledPluginIds(database)` from `src/plugins/plugins.service.ts`
  and do nothing when your plugin isn't in the list. Content a plugin creates is made with `ensureCollection`, which is safe
  to run again.
- **In the admin**, give the section a `plugin` in `src/navigation/sections.ts`; it's hidden
  while the plugin is off.

## Adding a plugin

Add an entry to `packages/core/src/plugins/plugins.registry.ts`: an `id`, a `name`, one
plain sentence for the setup screen, and any admin paths it owns. It's a visible list, so
nothing is discovered by file name. Later each entry will also register its own routes,
tables and admin screens from this same list.
