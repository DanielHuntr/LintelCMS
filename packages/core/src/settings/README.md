# Settings

Small site-wide settings, stored one per row in the `settings` table as JSON.

| File                     | What it does                                              |
| ------------------------ | --------------------------------------------------------- |
| `settings.table.ts`      | The `settings` table: tenant, key, JSON value, timestamps |
| `settings.schema.ts`     | Every setting key, the shape of its value and its default |
| `settings.service.ts`    | `readSetting`, `writeSetting` and `readOrCreateSetting`   |
| `settings.repository.ts` | Database reads and writes                                 |

To add a setting, add its key, schema and default to `settings.schema.ts`. Nothing else
changes: there is no column to add and no migration to write.

Current settings:

- `enabledPlugins`: which plugins are switched on (see `src/plugins`).
- `siteType` and `siteSetupCompleted`: the "What are you building?" setup step (see `src/setup`).
- `previewSigningSecret`: signs live preview links (see `src/preview`). Made once, the first
  time someone opens a preview, by `readOrCreateSetting`.
- `deliveryRequiresToken` and `deliveryAllowedOrigins`: who may read published content
  (see `src/delivery`).
- `seoDefaults`: the SEO plugin's site-wide defaults (see `src/seo`).
- `siteName`: the site's name, from the "What's your site called?" setup step. The admin
  gets it with the session (`siteName` in `/auth/me`) for the browser tab and the sidebar.
  This is the one place it is stored for now.
