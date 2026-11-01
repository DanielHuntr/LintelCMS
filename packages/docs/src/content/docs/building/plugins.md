---
title: Plugins
description: What plugins are, which ones Lintel has, and how they are switched on and off.
since: "0.1"
---

Optional features are plugins, so a new site only shows what it needs. The setup screen's
"What are you building?" step switches the first set on; **Settings → Features** changes
them later. The plugin system is in **beta**.

To build one, follow [Writing a plugin](/building/writing-a-plugin/); every option is in
the [plugin API reference](/building/plugin-api/).

## The plugins built into Lintel

| id         | Name        | What it adds                                                                    |
| ---------- | ----------- | ------------------------------------------------------------------------------- |
| `blog`     | Blog        | Makes the **Blog posts** collection, with Categories and Tags, when switched on |
| `commerce` | Online shop | Shows the Commerce section (screens on the roadmap)                             |
| `forms`    | Forms       | The Forms section, for people with `forms:read` (screens on the roadmap)        |
| `seo`      | SEO tools   | Search engine settings, redirects, the sitemap and the editor's SEO panel       |

Each is a `definePlugin` in its own feature folder (`packages/core/src/blog`, `…/forms`,
`…/seo`), listed in `packages/core/src/plugins/plugins.registry.ts`. Their admin halves
are listed in `packages/admin/src/plugins/adminPlugins.ts`.

## Plugins from packages

Other plugins are packages listed in `lintel.config.ts` at the repository root. Lintel
comes with one, the **Bookings** example (`packages/plugin-example-bookings`), so you can
see a working plugin; take it out of the list for a real site.

## Plugins are trusted code

A plugin runs inside Lintel's server with the same access to the database as Lintel
itself, and its admin screens run with the signed-in person's session. Lintel checks that
a plugin keeps to its own name (its permissions, tables and fieldtypes start with its id)
and hides it completely while it is switched off, but it does not sandbox it. Only install
plugins you have read or whose authors you trust.

## Switching on, off and uninstalling

| Step           | What happens                                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| **Install**    | Add the package and list it in `lintel.config.ts`; restart. Its tables are made, and it appears, switched off. |
| **Switch on**  | Its content is made (if it has any) and everything it adds appears for the people allowed to see it.           |
| **Switch off** | Its routes answer 404 `PLUGIN_NOT_ENABLED` and its screens disappear. Nothing is deleted.                      |
| **Uninstall**  | Remove it from `lintel.config.ts` and `package.json`; restart. Its tables stay until you drop them yourself.   |

## Writing code that depends on a plugin

- **A plugin's own routes** need nothing: Lintel guards them.
- **Other API code** calls `isPluginEnabled(database, "seo")` from `@lintel/core/plugin`
  and does nothing when it is off.
- **In the admin**, put the screen, sidebar item or panel in the plugin's
  `defineAdminPlugin`; it is hidden while the plugin is off.
