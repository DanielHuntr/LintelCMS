import { rm } from "node:fs/promises";
import { buildAdminIfChanged } from "./site/admin-build.js";
import { makeSiteTemplates, useSiteTemplates } from "./site/site-templates.js";

/**
 * Runs once before every test: builds the admin (if it changed) and makes the site
 * templates each test starts from. Returns the teardown, which deletes the templates.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  buildAdminIfChanged();
  const templatesFolder = await makeSiteTemplates();
  useSiteTemplates(templatesFolder);
  return () => rm(templatesFolder, { recursive: true, force: true });
}
