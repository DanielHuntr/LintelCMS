import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The folder of the package a module is in: the nearest one above it with a package.json.
 * A plugin's files move when it is built (src/server/index.ts becomes dist/server.js), so
 * paths inside the package, such as its migrations, are best found from here:
 *
 *   migrationsFolder: join(packageFolder(import.meta.url), "migrations"),
 */
export function packageFolder(moduleUrl: string): string {
  let folder = dirname(fileURLToPath(moduleUrl));
  while (!existsSync(join(folder, "package.json"))) {
    const parent = dirname(folder);
    if (parent === folder) {
      throw new Error(`No package.json was found above ${fileURLToPath(moduleUrl)}.`);
    }
    folder = parent;
  }
  return folder;
}
