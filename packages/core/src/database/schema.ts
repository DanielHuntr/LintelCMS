/**
 * The full database schema, gathered from each feature folder.
 * Each table lives next to the feature that owns it; this file only lists them
 * so Drizzle (and drizzle-kit migrations) can see everything at once.
 */
export { sitesTable } from "../sites/sites.table.js";
export { usersTable } from "../users/users.table.js";
export { rolesTable, userRolesTable } from "../roles/roles.table.js";
export { blueprintsTable } from "../blueprints/blueprints.table.js";
export { collectionsTable } from "../collections/collections.table.js";
export { entriesTable, revisionsTable } from "../entries/entries.table.js";
export { sessionsTable } from "../sessions/sessions.table.js";
export { settingsTable } from "../settings/settings.table.js";
export { assetsTable } from "../media/media.table.js";
export { binnedAssetsTable } from "../media/media-bin.table.js";
export { siteLocalesTable } from "../sites/locales.table.js";
export { taxonomiesTable, termsTable } from "../taxonomies/taxonomies.table.js";
export { globalSetsTable, globalValuesTable } from "../globals/globals.table.js";
export { fieldsetsTable } from "../fieldsets/fieldsets.table.js";
export { blocksTable } from "../blocks/blocks.table.js";
export { navigationsTable } from "../navigation/navigation.table.js";
export { apiTokensTable } from "../api-tokens/api-tokens.table.js";
export { webhooksTable, webhookDeliveriesTable } from "../webhooks/webhooks.table.js";
export { entrySeoTable, redirectsTable } from "../seo/seo.table.js";
export { dashboardLayoutsTable } from "../dashboard/dashboard.table.js";
export { oneTimeTokensTable } from "../one-time-tokens/one-time-tokens.table.js";
export { securityEventsTable } from "../security-log/security-events.table.js";
export { privacyRequestsTable } from "../privacy/privacy.table.js";
export { invitationsTable } from "../invitations/invitations.table.js";
export { twoFactorTable, recoveryCodesTable } from "../two-factor/two-factor.table.js";
export { passkeysTable } from "../passkeys/passkeys.table.js";
export {
  workflowsTable,
  workflowRunsTable,
  workflowStepLogsTable,
  workflowApprovalsTable,
  userNotificationsTable,
} from "../workflows/workflows.table.js";
export {
  formsTable,
  formSubmissionsTable,
  formSubmissionNotesTable,
} from "../forms/forms.table.js";
export * from "../commerce/commerce.tables.js";
export { userInterfaceLanguagesTable } from "../interface-languages/interface-languages.table.js";
export { recycleBinItemsTable } from "../recycle-bin/recycle-bin.table.js";
export { contentRootAddressesTable } from "../content-roots/content-roots.table.js";
export { backupsTable } from "../backups/backups.table.js";
export {
  wordpressImportsTable,
  wordpressImportItemsTable,
} from "../wordpress-import/wordpress-import.table.js";
export { siteImportsTable, siteImportItemsTable } from "../importers/site-import.table.js";
export { siteFontsTable } from "../site-fonts/site-fonts.table.js";
export {
  experimentsTable,
  experimentVersionsTable,
  experimentCountsTable,
} from "../experiments/experiments.table.js";
export {
  analyticsEventsTable,
  analyticsDailyTable,
  analyticsSaltsTable,
} from "../analytics/analytics.table.js";
export { clientReviewsTable } from "../client-editing/client-reviews.table.js";
