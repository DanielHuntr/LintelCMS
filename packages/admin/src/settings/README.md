# Settings

`/settings` is an index of every area of settings, laid out like iOS Settings with
`GroupedList`. Each row links to its own screen, owned by the feature it configures:

- **Content types** (`/build/content-types`) lives in `src/content-types`.
- **API access** (`/build/api`, and the reference at `/build/api/reference`) lives in
  `src/api-access`.
- **Webhooks** (`/build/webhooks`) lives in `src/webhooks`.
- **Your website** (`/settings/site`) lives in `src/website`: the built-in website's template, theme,
  logo and the site's one address, which View page uses.
- **Features** (`/build/features`) lives in `src/features`.
- Plugins add their own rows and groups (SEO's **Search engines**, say) through
  `settingsRows`; `PluginSettingsRows` draws them, only while the plugin is on.

- **Interface language** (`/account/language`) lives in `src/interface-language`.
- **Branding** (`/build/branding`) lives in `src/branding`, and only shows to people with
  `branding:update`.

Add a row here when a new settings screen is built, and hide it with `useCan` when the
signed-in person can't use it.
