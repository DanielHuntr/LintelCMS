import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SeededContent } from "./seed-site.js";
import { startSiteProcess } from "./test-site.js";

/**
 * Migrating a new database and seeding it take several seconds, so global-setup.ts does
 * both once and keeps the folders as templates. Every test site starts from a copy.
 *
 *   empty/    a migrated database with nobody in it: the setup wizard shows
 *   seeded/   setup done, two accounts and the content in seed-site.ts
 */

const TEMPLATES_VARIABLE = "LINTEL_E2E_TEMPLATES";

export interface SiteTemplates {
  empty: string;
  seeded: string;
  seededContent: SeededContent;
}

/** Makes both templates in a new temporary folder and returns it. */
export async function makeSiteTemplates(): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), "lintel-e2e-templates-"));
  const empty = join(folder, "empty");
  const seeded = join(folder, "seeded");

  const emptySite = await startSiteProcess(empty);
  await emptySite.stop();

  await cp(empty, seeded, { recursive: true });
  const seededSite = await startSiteProcess(seeded, { seed: true });
  await seededSite.stop();
  const seededContent = seededSite.seededContent;
  if (!seededContent) {
    throw new Error("The seeded site didn't say what it was seeded with.");
  }

  await writeFile(join(folder, "seeded-content.json"), JSON.stringify(seededContent, null, 2));
  return folder;
}

/** Tells the test workers, which inherit the environment, where the templates are. */
export function useSiteTemplates(folder: string): void {
  process.env[TEMPLATES_VARIABLE] = folder;
}

let cached: SiteTemplates | undefined;

/** The templates global-setup.ts made, read in each test worker. */
export async function siteTemplates(): Promise<SiteTemplates> {
  if (cached) {
    return cached;
  }
  const folder = process.env[TEMPLATES_VARIABLE];
  if (!folder) {
    throw new Error(`${TEMPLATES_VARIABLE} isn't set. Run the tests with \`pnpm e2e\`.`);
  }
  const seededContent = JSON.parse(
    await readFile(join(folder, "seeded-content.json"), "utf8"),
  ) as SeededContent;
  cached = { empty: join(folder, "empty"), seeded: join(folder, "seeded"), seededContent };
  return cached;
}
