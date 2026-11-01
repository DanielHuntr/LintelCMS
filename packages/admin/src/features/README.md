# Features

`/settings/features`: every feature (the API calls them plugins, see `packages/core/src/plugins`)
with its description and an on/off switch.

- Each switch saves straight away with `PUT /plugins`, then shows "Saved" with an Undo that puts
  back what was on before. The router's session is refreshed after each save, so the sidebar
  shows or hides the feature's section at once.
- Switching off a feature that holds content (Blog, Online shop, Forms) asks first, and the
  question says the content is kept: switching off only hides a section, it never deletes.
  The messages are in `featureContent.ts`.
- Anyone with `settings:read` can see the screen (and its row on `/settings`); only
  `settings:update` can flip the switches. Without it the switches are shown, disabled.

| File                            | What it does                                         |
| ------------------------------- | ---------------------------------------------------- |
| `FeaturesSettingsPage.tsx`      | The screen, its save status and the switch-off check |
| `features.api.ts`               | `GET /plugins` and `PUT /plugins`                    |
| `featureContent.ts`             | Which features hold content; the next set of ids     |
| `FeaturesSettingsPage.test.tsx` | The screen's behaviour                               |

Setup chooses the first set from the kind of site (see `packages/core/src/setup/site-presets.ts`).
