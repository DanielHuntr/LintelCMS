# Settings

Small site-wide settings, stored one per row in the `settings` table as JSON.

| File                     | What it does                                              |
| ------------------------ | --------------------------------------------------------- |
| `settings.table.ts`      | The `settings` table: tenant, key, JSON value, timestamps |
| `settings.schema.ts`     | Every setting key, the shape of its value and its default |
| `settings.service.ts`    | `readSetting` and `writeSetting`, checked by those shapes |
| `settings.repository.ts` | Database reads and writes                                 |

To add a setting, add its key, schema and default to `settings.schema.ts`. Nothing else
changes: there is no column to add and no migration to write.

Current settings:

- `enabledPlugins`: which plugins are switched on (see `src/plugins`).
- `siteType` and `siteSetupCompleted`: the "What are you building?" setup step (see `src/setup`).
- `siteName`: the site's name, from the "What's your site called?" setup step. The admin
  gets it with the session (`siteName` in `/auth/me`) for the browser tab and the sidebar.
  This is the one place it is stored for now.
