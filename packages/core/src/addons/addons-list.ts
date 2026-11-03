import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

/**
 * Where a site's add-ons live: `addons/` in the Lintel folder, beside `data/`. It is an
 * ordinary npm folder (`package.json`, `node_modules/`) plus `lintel-addons.json`, the list
 * Lintel loads, in order:
 *
 *   {
 *     "packages": ["@acme/lintel-swatches"],        installed from npm into node_modules
 *     "linked": ["/home/sam/code/my-addon"],        a folder being worked on (lintel addons link)
 *     "enableOnStart": ["swatches"]                 switch these on at the next start
 *   }
 *
 * The Lintel folder is kept through updates, roll backs and new Docker images, so add-ons
 * are too. Only `lintel addons` writes the list; nothing is found by looking around.
 */
export const ADDONS_LIST_FILE = "lintel-addons.json";

export const addonsListSchema = z.object({
  packages: z.array(z.string()).default([]),
  linked: z.array(z.string()).default([]),
  enableOnStart: z.array(z.string()).default([]),
});
export type AddonsList = z.output<typeof addonsListSchema>;

export function addonsFolderIn(lintelRoot: string): string {
  return join(lintelRoot, "addons");
}

/** The list, or an empty one when there is no folder or file yet. */
export async function readAddonsList(addonsFolder: string): Promise<AddonsList> {
  const file = join(addonsFolder, ADDONS_LIST_FILE);
  if (!existsSync(file)) return addonsListSchema.parse({});
  const parsed = addonsListSchema.safeParse(JSON.parse(await readFile(file, "utf8")));
  if (!parsed.success) {
    throw new Error(
      `${file} isn't a list of add-ons Lintel can read. Fix it, or remove it to start again.`,
    );
  }
  return parsed.data;
}

export async function writeAddonsList(addonsFolder: string, list: AddonsList): Promise<void> {
  await mkdir(addonsFolder, { recursive: true });
  await writeFile(
    join(addonsFolder, ADDONS_LIST_FILE),
    `${JSON.stringify(addonsListSchema.parse(list), null, 2)}\n`,
  );
}

/** Makes the folder an npm project of its own, so `npm install` puts packages in it. */
export async function prepareAddonsFolder(addonsFolder: string): Promise<void> {
  await mkdir(addonsFolder, { recursive: true });
  const packageFile = join(addonsFolder, "package.json");
  if (!existsSync(packageFile)) {
    await writeFile(
      packageFile,
      `${JSON.stringify({ name: "lintel-site-addons", private: true, dependencies: {} }, null, 2)}\n`,
    );
  }
}

/** Where npm put an installed package. */
export function installedPackageFolder(addonsFolder: string, packageName: string): string {
  return join(addonsFolder, "node_modules", ...packageName.split("/"));
}
