import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { z } from "zod";
import { listInstalledPluginPackages } from "../plugins/installed-plugins.js";
import { isNewerVersion, isVersion } from "./semantic-version.js";
import type { PluginUpdate } from "./updates.schema.js";

/**
 * Newer versions of the plugin packages lintel.config.ts lists, from the npm registry.
 * Private packages (a workspace plugin, such as the Bookings example) are never looked up,
 * and a package the registry doesn't know is simply left out.
 */

const REGISTRY_URL = "https://registry.npmjs.org";

const installedManifestSchema = z.object({
  version: z.string(),
  private: z.boolean().optional(),
});

const registryAnswerSchema = z.object({
  "dist-tags": z.object({ latest: z.string() }),
});

export async function findPluginUpdates(
  fetcher: typeof fetch,
  installFolder: string,
): Promise<PluginUpdate[]> {
  const packageNames = await listInstalledPluginPackages(installFolder);
  const updates: PluginUpdate[] = [];
  for (const packageName of packageNames) {
    const installed = await readInstalledManifest(installFolder, packageName);
    if (!installed || installed.private || !isVersion(installed.version)) {
      continue;
    }
    const latest = await latestPublishedVersion(fetcher, packageName);
    if (latest && isNewerVersion(latest, installed.version)) {
      updates.push({
        packageName,
        installedVersion: installed.version,
        latestVersion: latest,
        pageUrl: `https://www.npmjs.com/package/${packageName}`,
      });
    }
  }
  return updates;
}

async function readInstalledManifest(installFolder: string, packageName: string) {
  // Packages' "exports" often hide package.json, so look for it in each node_modules instead.
  const lookIn =
    createRequire(join(installFolder, "package.json")).resolve.paths(packageName) ?? [];
  for (const folder of lookIn) {
    const file = join(folder, packageName, "package.json");
    if (existsSync(file)) {
      const parsed = installedManifestSchema.safeParse(JSON.parse(await readFile(file, "utf8")));
      return parsed.success ? parsed.data : null;
    }
  }
  return null;
}

async function latestPublishedVersion(
  fetcher: typeof fetch,
  packageName: string,
): Promise<string | null> {
  try {
    const response = await fetcher(`${REGISTRY_URL}/${packageName.replace("/", "%2F")}`, {
      headers: { Accept: "application/vnd.npm.install-v1+json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      return null;
    }
    const parsed = registryAnswerSchema.safeParse(await response.json());
    return parsed.success && isVersion(parsed.data["dist-tags"].latest)
      ? parsed.data["dist-tags"].latest
      : null;
  } catch {
    return null;
  }
}
