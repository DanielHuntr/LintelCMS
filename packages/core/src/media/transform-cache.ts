import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resized images, kept on this computer's disk so each size is made once. The cache stays
 * local even when originals move to S3 or R2: it can always be rebuilt, so losing it only
 * costs time. Each asset gets its own folder, which makes deleting an asset's sizes one call.
 */

/** `.lintel/cache/media` at the repository root (gitignored with the rest of `.lintel`). */
export const DEFAULT_TRANSFORM_CACHE_FOLDER = fileURLToPath(
  new URL("../../../../.lintel/cache/media", import.meta.url),
);

export async function readCachedTransform(
  cacheFolder: string,
  assetId: string,
  cacheKey: string,
): Promise<Buffer | undefined> {
  try {
    return await readFile(cachedPath(cacheFolder, assetId, cacheKey));
  } catch {
    return undefined;
  }
}

export async function writeCachedTransform(
  cacheFolder: string,
  assetId: string,
  cacheKey: string,
  contents: Buffer,
): Promise<void> {
  const path = cachedPath(cacheFolder, assetId, cacheKey);
  await mkdir(join(cacheFolder, assetId), { recursive: true });
  // Two requests for a new size can finish together; renaming keeps either result whole.
  const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, contents);
  await rename(temporaryPath, path);
}

export async function removeCachedTransforms(cacheFolder: string, assetId: string): Promise<void> {
  await rm(join(cacheFolder, assetId), { recursive: true, force: true });
}

/** Asset ids are UUIDs and keys are hex, both checked before they get here, so this can't escape. */
function cachedPath(cacheFolder: string, assetId: string, cacheKey: string): string {
  return join(cacheFolder, assetId, cacheKey);
}
