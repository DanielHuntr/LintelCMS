# Add-ons

Plugins installed into a site rather than into Lintel's source: npm packages (or a folder
being worked on) in `addons/` inside the Lintel folder, beside `data/`. The reasoning is in
`docs/decisions/0052-the-add-on-kit.md`; the developer guide is the docs page "Building
add-ons". Everything a plugin can add is in `src/plugins`; this folder only finds, checks
and serves add-ons.

## The folder

```text
<Lintel folder>/addons/
  package.json            an npm project of its own, so `npm install` puts packages here
  node_modules/           the installed packages
  lintel-addons.json      the list: packages, linked folders, ids to switch on at start
```

The Lintel folder is `.lintel` in a copy of the source, `<home>/.lintel` under `lintel start`
and `/data` in Docker. Updates and roll backs never touch it, so add-ons stay installed.
Backups don't include it: add-ons are code, installed again with `lintel addons add`. Their
own tables aren't in backups yet either (backups cover Lintel's schema).

## An add-on package

`package.json` has a `lintel-addon` section (`addon-package.ts`): the plugin id, the Lintel
versions it works with (`version-range.ts`) and its built `server` and `admin` files.
`lintel addons build` (packages/cli) bundles both with esbuild, leaving out the modules
listed in `addon-module-names.ts`. The bundle reads those from
`globalThis.__lintelAddonModules`, which `addon-modules.ts` fills in on the server and
`packages/admin/src/addons` in the admin, so a prebuilt Lintel can load an add-on without
installing anything beside it.

An add-on can also say what personal data it keeps, under `personalData` in that section:
`{ tables: [{ name, columns: [{ name, personalData: true }] }] }`. Settings → Privacy lists it
(see src/privacy). The hooks that let it be searched go in `definePlugin`.

## At start

`site-addons.ts` (called by main.ts and the production server) loads each add-on on its own
(`load-addons.ts`). One that isn't installed, doesn't work with this version, fails to load,
uses a taken id or fails the plugin checks is left out with a plain message in
`server.addons.problems`; the site starts without it. The rest are added to the plugin
catalogue after the built-in plugins and lintel.config.ts's, and behave exactly like them:
`enabledPlugins` switches them on and off. Ids in `enableOnStart` are switched on once they
load, then taken off the list.

## Endpoints

| Method and path             | Permission      | Success                                     |
| --------------------------- | --------------- | ------------------------------------------- |
| `GET /addons`               | `settings:read` | 200 `{ addons: [AddonSummary], folder }`    |
| `GET /addons/admin-scripts` | none            | 200 `{ scripts: [{ id, script, styles }] }` |
| `GET /addons/:id/admin.js`  | none            | 200, the add-on's admin half                |
| `GET /addons/:id/admin.css` | none            | 200, its stylesheet; 404 when it has none   |

`AddonSummary = { id, name, description, packageName, version, from, enabled, adds, permissions, settingsSchema, problem }`.
Switching on and off and settings use the plugins endpoints (`PUT /plugins`,
`/plugins/:id/settings`). Admin files are public, like the admin's own code.

## Files

| File                    | What it does                                                |
| ----------------------- | ----------------------------------------------------------- |
| `addons-list.ts`        | The folder and `lintel-addons.json`                         |
| `addon-package.ts`      | Reading and checking a package's `lintel-addon` section     |
| `version-range.ts`      | Whether a Lintel version is in an add-on's range            |
| `addon-module-names.ts` | The modules add-ons share with Lintel (browser-safe)        |
| `addon-modules.ts`      | Lintel's copies of the server's shared modules              |
| `load-addons.ts`        | Loading each add-on on its own, with plain problems         |
| `site-addons.ts`        | The add-ons of a Lintel folder, for start-up                |
| `addons.service.ts`     | The list for the screen, admin files, switching on at start |
| `addons.routes.ts`      | The endpoints                                               |
| `addons.schema.ts`      | Zod schemas for responses                                   |
| `addons.errors.ts`      | Named errors                                                |
