import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { addonDeclarationsSchema } from "./addon-declarations.js";
import { personalDataDeclarationSchema } from "../privacy/personal-data-declaration.js";
import { isReadableRange } from "./version-range.js";

/**
 * What an add-on says about itself, in its package.json:
 *
 *   "lintel-addon": {
 *     "id": "swatches",                 the plugin id its definePlugin uses
 *     "lintel": ">=1.0.0-rc.1",         the Lintel versions it works with
 *     "server": "dist/server.js",       its server half, built by `lintel addons build`;
 *                                       left out by one that only says what data it keeps
 *     "admin": "dist/admin.js",         its admin half, if it has one
 *     "tables": [...],                  what it keeps, and the rest of addon-declarations.ts
 *     "personalData": { "tables": [...] }  what personal data it keeps (see src/privacy)
 *   }
 *
 * Its `license`, `author` and `repository` (or `homepage`) say where it comes from.
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
  ...addonDeclarationsSchema.shape,
  /** The tables and columns it keeps personal data in, for Settings → Privacy. */
  personalData: personalDataDeclarationSchema.optional(),
});
export type AddonManifest = z.output<typeof addonManifestSchema>;

const personSchema = z.union([
  z.string(),
  z.object({ name: z.string().optional() }).transform((person) => person.name ?? ""),
]);
const linkSchema = z.union([
  z.string(),
  z.object({ url: z.string().optional() }).transform((link) => link.url ?? ""),
]);

const packageFileSchema = z.object({
  name: z.string(),
  version: z.string().default("0.0.0"),
  description: z.string().default(""),
  license: z.string().optional().catch(undefined),
  author: personSchema.optional().catch(undefined),
  repository: linkSchema.optional().catch(undefined),
  homepage: z.string().optional().catch(undefined),
  [ADDON_MANIFEST_KEY]: z.unknown().optional(),
});

/** Where an add-on comes from, as its package.json says. */
export interface AddonOrigin {
  publisher: string | null;
  licence: string | null;
  /** Its source code or home page. */
  source: string | null;
}

/** An add-on package on disk, read and checked. */
export interface AddonPackage {
  packageName: string;
  version: string;
  description: string;
  folder: string;
  manifest: AddonManifest;
  origin: AddonOrigin;
  /**
   * Whether it has no code of its own and only says what data it keeps, in package.json:
   * no `server` named, nothing built and nothing to build, and something declared. One that
   * names a `server` or has src/server is only unbuilt, and is told so.
   */
  dataOnly: boolean;
}

/** "git+https://github.com/a/b.git" as a link people can open. */
function readableSource(address: string | undefined): string | null {
  if (!address) return null;
  const cleaned = address.replace(/^git\+/, "").replace(/\.git$/, "");
  return /^https?:\/\//.test(cleaned) ? cleaned : null;
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
  const namesServer =
    (packageInfo[ADDON_MANIFEST_KEY] as { server?: unknown }).server !== undefined;
  return {
    packageName: packageInfo.name,
    version: packageInfo.version,
    description: packageInfo.description,
    folder,
    manifest: manifest.data,
    dataOnly:
      !namesServer &&
      !existsSync(join(folder, manifest.data.server)) &&
      !existsSync(join(folder, "src", "server")) &&
      (manifest.data.tables.length > 0 || (manifest.data.personalData?.tables.length ?? 0) > 0),
    origin: {
      publisher: packageInfo.author?.trim() || null,
      licence: packageInfo.license?.trim() || null,
      source: readableSource(packageInfo.repository) ?? readableSource(packageInfo.homepage),
    },
  };
}
