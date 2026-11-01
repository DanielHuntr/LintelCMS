# Features

**Settings → Features** (`/settings/features`): every feature (the API calls them plugins, see
`packages/core/src/plugins`) with its description and an on/off switch, in two groups: the ones
built into Lintel and the ones added by a developer in `lintel.config.ts` (with their version).
The second group, and the group headers, only show when something is installed.

- Each switch saves straight away with `PUT /plugins`, then shows "Saved" with an Undo that puts
  back what was on before. The router's session is refreshed after each save, and its
  `enabledPlugins` decides what the sidebar, settings, dashboards and editor show, so the admin
  follows at once.
- Switching off a feature that may hold content (Blog, Online shop, Forms, and every installed
  plugin) asks first, and the question says the content is kept: switching off only hides a
  feature, it never deletes. The messages are in `featureContent.ts`.
- Anyone with `settings:read` can see the screen (and its row on `/settings`); only
  `settings:update` can flip the switches. Without it the switches are shown, disabled.

| File                            | What it does                                         |
| ------------------------------- | ---------------------------------------------------- |
| `FeaturesSettingsPage.tsx`      | The screen, its save status and the switch-off check |
| `features.api.ts`               | `GET /plugins` and `PUT /plugins`                    |
| `featureContent.ts`             | Which features hold content; the next set of ids     |
| `FeaturesSettingsPage.test.tsx` | The screen's behaviour                               |

Setup chooses the first set from the kind of site (see `packages/core/src/setup/site-presets.ts`).
