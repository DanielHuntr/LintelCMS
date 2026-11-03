import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { personalDataDeclarationSchema } from "../privacy/personal-data-declaration.js";
import { isReadableRange } from "./version-range.js";

/**
 * What an add-on says about itself, in its package.json:
 *
 *   "lintel-addon": {
 *     "id": "swatches",                 the plugin id its definePlugin uses
 *     "lintel": ">=1.0.0-rc.1",         the Lintel versions it works with
 *     "server": "dist/server.js",       its server half, built by `lintel addons build`
 *     "admin": "dist/admin.js",         its admin half, if it has one
 *     "personalData": { "tables": [...] }  what personal data it keeps (see src/privacy)
 *   }
 */
export const ADDON_MANIFEST_KEY = "lintel-addon";

export const addonManifestSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z][a-z0-9-]*$/, { error: "id should be lowercase letters, numbers and dashes" }),
  lintel: z.string().refine(isReadableRange, {
    error: 'lintel should be a range of versions, such as ">=1.0.0-rc.1"',
  }),
  server: z.string().default("dist/server.js"),
  admin: z.string().optional(),
  /** A stylesheet for the admin half, loaded with it. */
  adminStyles: z.string().optional(),
  /** The tables and columns it keeps personal data in, for Settings → Privacy. */
  personalData: personalDataDeclarationSchema.optional(),
});
export type AddonManifest = z.output<typeof addonManifestSchema>;

const packageFileSchema = z.object({
  name: z.string(),
  version: z.string().default("0.0.0"),
  description: z.string().default(""),
  [ADDON_MANIFEST_KEY]: z.unknown().optional(),
});

/** An add-on package on disk, read and checked. */
export interface AddonPackage {
  packageName: string;
  version: string;
  description: string;
  folder: string;
  manifest: AddonManifest;
}

/** A problem with an add-on, said plainly enough for the person who installed it. */
export class AddonPackageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AddonPackageError";
  }
}

export async function readAddonPackage(folder: string): Promise<AddonPackage> {
  const packageFile = join(folder, "package.json");
  if (!existsSync(packageFile)) {
    throw new AddonPackageError(`There's no add-on at ${folder}: it has no package.json.`);
  }
  const parsed = packageFileSchema.safeParse(JSON.parse(await readFile(packageFile, "utf8")));
  if (!parsed.success) {
    throw new AddonPackageError(`${packageFile} has no package name.`);
  }
  const packageInfo = parsed.data;
  if (packageInfo[ADDON_MANIFEST_KEY] === undefined) {
    throw new AddonPackageError(
      `${packageInfo.name} isn't a Lintel add-on: its package.json has no "${ADDON_MANIFEST_KEY}" section.`,
    );
  }
  const manifest = addonManifestSchema.safeParse(packageInfo[ADDON_MANIFEST_KEY]);
  if (!manifest.success) {
    const reason = manifest.error.issues[0]?.message ?? "it can't be read";
    throw new AddonPackageError(
      `${packageInfo.name}'s "${ADDON_MANIFEST_KEY}" section: ${reason}.`,
    );
  }
  return {
    packageName: packageInfo.name,
    version: packageInfo.version,
    description: packageInfo.description,
    folder,
    manifest: manifest.data,
  };
}
