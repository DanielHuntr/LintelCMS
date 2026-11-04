# Add-ons (admin)

The admin's side of add-ons, plugins installed into a site (see
`packages/core/src/addons` and docs/decisions/0052-the-add-on-kit.md).

## Loading their admin halves

`loadAddonAdminHalves.ts` runs in `main.tsx` before anything is drawn. It asks the API which
add-ons have an admin half (`GET /addons/admin-scripts`), puts the admin's shared modules on
`globalThis.__lintelAddonModules` (`sharedAddonModules.ts`: React, the query client and
`@lintel/admin/plugin`, the ones `lintel addons build` leaves out of bundles) and imports
each one. The definitions join the list in `plugins/adminPlugins.ts`, so their sidebar
items, screens, widgets and field editors behave exactly like built-in plugins'. One that
fails to load is noted in `failedAddonAdminHalves` and the rest still load.

Add-on bundles can only rely on CSS classes the admin already uses; anything else goes in
their own stylesheet (`adminStyles` in their package.json), which is loaded with them.

## The Add-ons screen

`/build/addons` (`AddonsPage.tsx`): installed add-ons with whether each is on, and those
that can't run with why. Choosing one opens `AddonDetailsDialog.tsx`: its switch (saved
through `PUT /plugins`), a link to its own screen while it's on, the honest line about full
access, then folded sections from
`GET /addons/:id/details`, stored data first and open (`AddonAbout.tsx`). Each item is
marked "Checked by Lintel" or "Says the add-on". `AddonRemoval.tsx` exports its data, and
keeps or deletes it before the remove command. Settings get a form drawn from their JSON Schema (`settingsForm.ts`,
`AddonSettingsForm.tsx`) when they are simple enough; otherwise the add-on brings its own
screen.

| File                      | What it does                                         |
| ------------------------- | ---------------------------------------------------- |
| `addons.api.ts`           | Calls to `/addons` and the plugin settings endpoints |
| `loadAddonAdminHalves.ts` | Loading add-ons' admin halves at start               |
| `sharedAddonModules.ts`   | The modules add-ons share with the admin             |
| `AddonsPage.tsx`          | The Add-ons screen                                   |
| `AddonDetailsDialog.tsx`  | One add-on: switch, details, settings, removal       |
| `AddonAbout.tsx`          | What it stores, adds, runs, talks to, comes from     |
| `AddonRemoval.tsx`        | Export, keep or delete its data, and removing it     |
| `AddonSettingsForm.tsx`   | A settings form drawn from a schema                  |
| `settingsForm.ts`         | Reading that schema into fields                      |
| `addonStrings.ts`         | The words, spread into i18n/strings.ts               |
