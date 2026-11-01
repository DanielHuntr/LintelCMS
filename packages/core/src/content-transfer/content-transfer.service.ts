import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import type { ImportPlan } from "./content-import-plan.js";
import { type ImportContext, previewImport, runImport } from "./content-import.service.js";
import { ImportUploadNotFoundError } from "./content-transfer.errors.js";
import { openImportSource } from "./import-source.js";
import type { ConflictStrategy } from "./transfer-format.js";

/**
 * Settings → Import's steps: upload a file, preview what it would do, then import it. The
 * upload waits in the imports folder between the steps, named by a random id; uploads
 * nobody imported are tidied away after a day.
 */
const ONE_DAY = 24 * 60 * 60 * 1000;

export interface UploadedImport {
  uploadId: string;
  plan: ImportPlan;
}

export async function keepUploadedExport(
  context: ImportContext,
  folder: string,
  uploadedPath: string,
): Promise<UploadedImport> {
  await removeOldUploads(folder);
  const uploadId = randomUUID();
  const path = uploadPath(folder, uploadId);
  await rename(uploadedPath, path);
  try {
    return { uploadId, plan: await previewUploadedExport(context, folder, uploadId, "skip") };
  } catch (error) {
    await rm(path, { force: true });
    throw error;
  }
}

export async function previewUploadedExport(
  context: ImportContext,
  folder: string,
  uploadId: string,
  strategy: ConflictStrategy,
): Promise<ImportPlan> {
  const source = await openImportSource(findUpload(folder, uploadId));
  try {
    return await previewImport(context, source, strategy);
  } finally {
    source.close();
  }
}

export async function importUploadedExport(
  context: ImportContext,
  folder: string,
  uploadId: string,
  strategy: ConflictStrategy,
): Promise<ImportPlan> {
  const path = findUpload(folder, uploadId);
  const source = await openImportSource(path);
  try {
    return await runImport(context, source, strategy);
  } finally {
    source.close();
    await rm(path, { force: true });
  }
}

function uploadPath(folder: string, uploadId: string): string {
  return join(folder, `export-${uploadId}`);
}

function findUpload(folder: string, uploadId: string): string {
  const path = uploadPath(folder, uploadId);
  if (!existsSync(path)) {
    throw new ImportUploadNotFoundError();
  }
  return path;
}

async function removeOldUploads(folder: string): Promise<void> {
  const names = existsSync(folder) ? await readdir(folder) : [];
  for (const name of names.filter((candidate) => candidate.startsWith("export-"))) {
    const path = join(folder, name);
    if (Date.now() - (await stat(path)).mtimeMs > ONE_DAY) {
      await rm(path, { force: true });
    }
  }
}
