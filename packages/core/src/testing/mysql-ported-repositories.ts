/**
 * Repositories moved to the dialect layer and run on MySQL and MariaDB by their
 * `*.dialects.test.ts`, in the order they moved. `mysql-ported-repositories.test.ts` holds
 * each of them to it. Add a repository here in the commit that moves it.
 */
export const mysqlPortedRepositories = [
  "sites/sites.repository.ts",
  "sites/locales.repository.ts",
  "site-fonts/site-fonts.repository.ts",
  "settings/settings.repository.ts",
  "interface-languages/interface-languages.repository.ts",
  "sessions/sessions.repository.ts",
  "one-time-tokens/one-time-tokens.repository.ts",
  "security-log/security-log.repository.ts",
  "api-tokens/api-tokens.repository.ts",
  "seo/redirects.repository.ts",
  "fieldsets/fieldsets.repository.ts",
  "blueprints/blueprints.repository.ts",
  "two-factor/two-factor.repository.ts",
  "passkeys/passkeys.repository.ts",
];
