# Data tools: Settings → Backups and Settings → Import

The screens for backups, moving content between Lintel sites, and importing from
WordPress. The rules all live in core (`src/backups`, `src/content-transfer`,
`src/wordpress-import`); these screens show what the API says and send what people choose.

| Screen                           | Component                                                         |
| -------------------------------- | ----------------------------------------------------------------- |
| `/settings/backups`              | `BackupsPage` (`BackupList`, `BackupScheduleCard`)                |
| `/settings/backups/:id/restore`  | `RestorePage`                                                     |
| `/settings/import`               | `ImportPage` (`LintelImportCard`, export)                         |
| `/settings/import/wordpress`     | `WordPressImportsPage`                                            |
| `/settings/import/wordpress/:id` | `WordPressImportPage` (`WordPressMappingStep`, `WordPressReport`) |

Routes are made in `dataToolsRoutes.tsx` and added in `router.tsx`; the links are in
Settings under "Your site's data".

Things worth knowing:

- **Restoring is hard to do by accident.** The restore screen says what will be replaced,
  shows now beside after, and only enables the button once the box is ticked and
  `RESTORE` is typed. The API checks the word too.
- **Long work is polled.** Making a backup and running a WordPress import answer
  straight away; `dataTools.queries.ts` polls while something is running, so people can
  leave the page and come back to the progress.
- **Uploads show progress.** `FilePicker` and the upload helpers in `dataTools.api.ts`
  report a percentage, because backups can be large.
- **The plan is the preview.** The Lintel import shows the server's plan as a table
  (new, updated, kept as is) before anything changes, and the WordPress importer shows a
  dry run's report in the same form as the final one.

Text is in `src/i18n/dataToolsStrings.ts`, spread into `strings.ts`. Tests:
`DataTools.test.tsx`.
