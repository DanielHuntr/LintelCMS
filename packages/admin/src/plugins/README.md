# Plugins (admin)

The admin half of the plugin system. A plugin's admin half is a `defineAdminPlugin({...})`
(`adminPlugin.ts`) with the same id as its server half, adding any of: sidebar items,
screens, Settings rows, dashboard widgets, section tabs, entry editor panels and field
editors. Each can name a permission, and nothing shows while the plugin is switched off.

## Where they come from

`adminPlugins.ts` is the one list: the built-in admin halves (Forms in `src/forms`, SEO in
`src/seo`), then the installed ones from `virtual:lintel-plugins`. That module is written
at build time by `vite-plugin-lintel.ts` (in the package root) from `lintel.config.ts`: one
`import` per package's `./admin`. So plugins are real React code, bundled and type-checked
with the admin and sharing its React, router and query cache.

## Where contributions are drawn

| Contribution       | Drawn by                                                     |
| ------------------ | ------------------------------------------------------------ |
| `sidebarItems`     | `src/navigation/sections.ts`, after Media                    |
| `screens`          | `PluginScreenRoute.tsx`, the router's catch-all route        |
| `settingsRows`     | `PluginSettingsRows.tsx`, on the Settings screen             |
| `dashboardWidgets` | `src/dashboard`                                              |
| `dashboardTabs`    | `SectionTabs.tsx`, around the dashboard and Content overview |
| `editorPanels`     | `PluginEditorPanels.tsx`, in the entry editor's side panel   |
| `fieldEditors`     | `src/fields/FieldEditor.tsx`                                 |

`pluginContributions.ts` decides who sees what (plugin on, permission held).
`AdminPluginsContext` hands the list to screens, so tests can try a plugin without
installing it:

```tsx
<AdminPluginsContext.Provider value={[myPlugin]}>{screen}</AdminPluginsContext.Provider>
```

## For plugin authors

`plugin-api.ts` is `@lintel/admin/plugin`: everything a plugin may import, including the
design system, `apiRequest`, `useCan`, `createTranslator` (a plugin's own `t()`), and
`PluginLink` / `PluginBackLink` / `usePluginNavigate` (plugin addresses aren't in the
router's typed list).

| File                      | What it does                                       |
| ------------------------- | -------------------------------------------------- |
| `adminPlugin.ts`          | `defineAdminPlugin` and the contribution types     |
| `adminPlugins.ts`         | The list of admin halves                           |
| `pluginContributions.ts`  | Who sees which contribution                        |
| `AdminPluginsContext.tsx` | The list, for screens and tests                    |
| `PluginScreenRoute.tsx`   | Plugin screens, or "Page not found"                |
| `matchScreenPath.ts`      | Matching `/bookings/$bookingId` against an address |
| `SectionTabs.tsx`         | Tabs beside a section's own screen                 |
| `PluginSettingsRows.tsx`  | Rows on the Settings screen                        |
| `PluginEditorPanels.tsx`  | Panels in the entry editor                         |
| `PluginLink.tsx`          | Links and navigation to plugin screens             |
| `createTranslator.ts`     | A plugin's own words                               |
| `plugin-api.ts`           | `@lintel/admin/plugin`                             |
