# Importers: Settings → Import → Move your site to Lintel

The hub (`MoveYourSiteList`, shown on the data tools' `ImportPage`) and the screens for
Webflow, Framer, Statamic and Umbraco. WordPress's screens are in `src/data-tools`, and
these reuse its parts (`ChoiceSelect`, `ProgressBar`, `ReportSection`, `FilePicker`), so
every importer goes the same way: upload → what we found and can't move → mapping → dry
run → progress (polled; leave and come back) → report. The rules are in core
(`packages/core/src/importers`).

| Screen                         | Component                                                    |
| ------------------------------ | ------------------------------------------------------------ |
| `/settings/import/:source`     | `SiteImportsPage`: upload and earlier imports                |
| `/settings/import/:source/:id` | `SiteImportPage` (`SiteMappingStep`, `SiteImportReportView`) |

Routes are made in `importersRoutes.tsx` and added in `router.tsx`; text is in
`src/i18n/importersStrings.ts`. `fieldCompatibility.ts` mirrors the API's list of which
fields can take which kind of value, so only acceptable fields are offered.
