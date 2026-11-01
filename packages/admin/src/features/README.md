# Features

**Settings → Features** (`/settings/features`): every plugin with an on/off switch, in two
groups: the ones built into Lintel and the ones added by a developer in `lintel.config.ts`
(with their version). It reads and saves `GET` and `PUT /plugins`. After a change the
router reloads the session, whose `enabledPlugins` decides what the sidebar, settings,
dashboards and editor show, so the admin follows straight away.

Switching a feature off hides it and keeps everything it made; the status line says so.
People with `settings:read` but not `settings:update` see the switches, disabled, with a
sentence saying who can change them.

| File                       | What it does           |
| -------------------------- | ---------------------- |
| `FeaturesSettingsPage.tsx` | The screen             |
| `features.api.ts`          | The two calls it makes |
