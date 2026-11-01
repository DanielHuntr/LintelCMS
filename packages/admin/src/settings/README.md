# Settings

`/settings` is an index of every area of settings, laid out like iOS Settings with
`GroupedList`. Each row links to its own screen, owned by the feature it configures:

- **Content types** (`/settings/content-types`) lives in `src/content-types`.
- **API access** (`/settings/api`, and the reference at `/settings/api/reference`) lives in
  `src/api-access`.
- **Webhooks** (`/settings/webhooks`) lives in `src/webhooks`.
- **Site** (`/settings/site`) lives in `src/site`: the website's address, used by View page.
- **Features** (`/settings/features`) lives in `src/features`.
- Plugins add their own rows and groups (SEO's **Search engines**, say) through
  `settingsRows`; `PluginSettingsRows` draws them, only while the plugin is on.

Add a row here when a new settings screen is built, and hide it with `useCan` when the
signed-in person can't use it.
