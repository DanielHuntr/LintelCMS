# 52. The add-on kit: plugins that install into a running site

Date: 2026-11-03

## Where we started (audit)

Decision 0012 made plugins trusted packages with a server half (`definePlugin`) and an admin
half (`defineAdminPlugin`). Built-in features (blog, forms, shop, SEO...) and the Bookings
example are written that way. Before this work, each kind of add-on a developer might want
to build stood like this:

| Extension point            | For plugins already? | How                                                                                     | Gap                                                                                                         |
| -------------------------- | -------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Field types                | Yes                  | `fieldtypes` (`defineFieldtype`, Zod value schema) + admin `fieldEditors`               | No say in how the value is delivered (REST, GraphQL and Liquid all get the stored value as it is)           |
| Liquid tags and filters    | No                   | Core registers its own in `liquid-tags.ts`                                              | No way for a plugin to add any                                                                              |
| Builder elements           | Yes                  | `blocks` (`defineBlock`): properties, a template or a React component drawn server-side | None for elements with properties; documented as the element API                                            |
| Dashboard widgets, screens | Yes                  | Admin `dashboardWidgets`, `sidebarItems`, `screens`, `settingsRows`, `dashboardTabs`    | None                                                                                                        |
| Settings screen            | Partly               | `settings` (Zod + defaults) and `GET/PUT /plugins/:id/settings`                         | Every plugin had to draw its own settings screen                                                            |
| Events                     | Unofficially         | `server.events.on(...)` from inside `routes`                                            | Not declared, runs while the plugin is off, no typed per-plugin handlers                                    |
| Scheduled jobs             | No                   | Core and built-in features start their own in `registerX`                               | No way for a plugin to add one                                                                              |
| Rich text extensions       | No                   | One fixed TipTap list in the admin, one fixed HTML renderer in core                     | Needs a node shared by the editor, the checks and the HTML renderer                                         |
| CLI commands               | No                   | One fixed list in `packages/cli/src/command-line.ts`                                    | No way for a plugin to add one                                                                              |
| Packaging and install      | Source only          | `pnpm add -w` + `lintel.config.ts`; the admin half is bundled at build time             | A release install (`lintel start`, Docker) has a prebuilt admin and no workspace, so it can't add a package |
| Failures                   | No                   | A bad plugin stops the server at start                                                  | One broken add-on takes the whole site down                                                                 |
| Compatibility              | No                   | -                                                                                       | Nothing says which Lintel versions a package works with                                                     |

## Decision

An **add-on** is a plugin delivered as an npm package and installed into a site's Lintel
folder, next to its data, rather than into the source tree. Everything 0012 says about
plugins still holds: same `definePlugin` / `defineAdminPlugin`, same trust model, same
`enabledPlugins` switch. Plugins listed in `lintel.config.ts` keep working unchanged.

### New extension points on `definePlugin`

- `liquid.tags` and `liquid.filters`: `{% opening_hours %}`, `{{ value | swatch_name }}`.
  Names start with the plugin id (dashes as underscores), as blocks do. While the plugin is
  off a tag draws nothing and a filter hands its value back, so templates don't break.
- `events`: typed handlers keyed by event name, run only while the plugin is on, each
  failure logged on its own.
- `jobs`: `{ id, name, everyMinutes, run }`, run by the scheduler only while the plugin is on.
- `commands`: `lintel <plugin-id>:<command>` in the terminal.
- Field types gain `deliver(value, options)`, used by the delivery API, GraphQL and Liquid.
- A plugin with `settings` and no settings screen of its own gets one drawn from its Zod
  schema on the Add-ons screen.

### Packaging

The package's `package.json` has a `lintel-addon` section: the plugin id, the range of
Lintel versions it works with, and its built server and admin files. `lintel addons build`
bundles both halves with esbuild. The modules that must be Lintel's own copy (React, the
query client, `@lintel/admin/plugin`, `@lintel/core/plugin`, Zod, Drizzle) are not bundled:
the bundle reads them from Lintel at run time. So a prebuilt admin can load an add-on's
admin half with `import()`, and the server half needs nothing installed beside it.

### Install

`lintel addons add <package>` runs `npm install` in `<Lintel folder>/addons` (next to
`data/`), writes the package to `addons/lintel-addons.json` and asks the server to switch it
on at its next start. `remove` reverses it and keeps the add-on's data. Because the folder
lives beside the data, add-ons stay installed across updates, roll backs and new Docker
images.

On start each add-on is loaded on its own. One that can't be found, isn't compatible with
the running Lintel or fails its checks is left out with a plain message on the Add-ons
screen; the rest of the site starts as usual.

## Why

- **Release installs can't rebuild the admin.** Loading admin halves at run time against
  modules Lintel shares is the smallest change that works for every install type. 0012 kept
  plugins at build time because there was no stable surface to share; `@lintel/admin/plugin`
  and `@lintel/core/plugin` are that surface now.
- **The data folder survives everything.** It is the one place every install type keeps
  through updates (the supervisor never touches it) and container rebuilds (it is the volume).
- **A broken add-on must not cost a site.** People install add-ons themselves now; failures
  are shown, not thrown.

## Not now

- No directory or marketplace: add-ons come from npm or a folder, and Lintel hosts nothing.
- No sandbox: add-ons are trusted code, as 0012 says, and the Add-ons screen says so.
- Rich text extensions: see the docs page "Building add-ons" for the plan.
