import { readFile, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import multipart from "@fastify/multipart";
import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  NoArchiveUploadedError,
  saveUploadedFiles,
  UploadTooLargeError,
} from "../archives/uploaded-archive.js";
import { getSignedIn, requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { WordPressImportNotFoundError } from "./wordpress-import.errors.js";
import { importIdParamsSchema, wordpressImportMappingSchema } from "./wordpress-import.schema.js";
import {
  createWordPressImport,
  deleteWordPressImport,
  describeFieldMapping,
  describeMappingChoices,
  dryRunImport,
  getWordPressImport,
  listWordPressImports,
  saveMapping,
  startWordPressImport,
  type WordPressImportContext,
} from "./wordpress-import.service.js";

const MAX_UPLOAD_MEGABYTES = 4096;
const MAX_EXPORT_MEGABYTES = 256;

/**
 * HTTP only. Imports write all over the site, so they need `content:transfer`:
 *
 *   GET    /wordpress-imports              -> { imports }
 *   POST   /wordpress-imports              multipart "export" (.xml) and optional "content" (.zip) -> 201
 *   GET    /wordpress-imports/:id          -> import with its report
 *   GET    /wordpress-imports/:id/mapping  -> { import, collections, taxonomies, suggested }
 *   PUT    /wordpress-imports/:id/mapping  Mapping -> { mapping, fields }
 *   POST   /wordpress-imports/:id/dry-run  -> report of what it would do
 *   POST   /wordpress-imports/:id/start    -> 202, runs (or resumes) in the background
 *   DELETE /wordpress-imports/:id          -> 204 (what it imported stays)
 */
export async function wordpressImportRoutes(server: FastifyInstance) {
  await server.register(multipart, {
    limits: { fileSize: MAX_UPLOAD_MEGABYTES * 1024 * 1024, files: 2, fields: 0 },
  });
  const guard = { preHandler: requirePermission("content:transfer") };
  const context = (): WordPressImportContext => ({
    database: server.database,
    storage: server.dataTools.storage,
    publicApiUrl: server.publicApiUrl,
    importsFolder: server.dataTools.importsFolder,
    download: { allowPrivateAddresses: server.dataTools.allowPrivateDownloads },
    tasks: server.dataTools.tasks,
  });

  server.get("/wordpress-imports", guard, async () => ({
    imports: await listWordPressImports(server.database),
  }));

  server.post("/wordpress-imports", guard, async (request, reply) => {
    const folder = server.dataTools.importsFolder;
    const { files } = await saveUploadedFiles(request, folder, MAX_UPLOAD_MEGABYTES);
    const exportFile = files.get("export");
    const contentFile = files.get("content");
    try {
      if (!exportFile) {
        throw new NoArchiveUploadedError();
      }
      if ((await stat(exportFile.path)).size > MAX_EXPORT_MEGABYTES * 1024 * 1024) {
        throw new UploadTooLargeError(MAX_EXPORT_MEGABYTES);
      }
      let contentZipFile: string | null = null;
      if (contentFile) {
        contentZipFile = `wordpress-content-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.zip`;
        await rename(contentFile.path, join(folder, contentZipFile));
      }
      const created = await createWordPressImport(context(), {
        filename: exportFile.filename,
        xml: await readFile(exportFile.path, "utf8"),
        contentZipFile,
        startedBy: getSignedIn(request).user.id,
      });
      return reply.code(201).send(created);
    } finally {
      await Promise.all([...files.values()].map((file) => rm(file.path, { force: true })));
    }
  });

  server.get("/wordpress-imports/:id", guard, async (request) =>
    getWordPressImport(server.database, readImportId(request)),
  );

  server.get("/wordpress-imports/:id/mapping", guard, async (request) =>
    describeMappingChoices(context(), readImportId(request)),
  );

  server.put("/wordpress-imports/:id/mapping", guard, async (request) => {
    const mapping = parseRequest(wordpressImportMappingSchema, request.body ?? {});
    const saved = await saveMapping(context(), readImportId(request), mapping);
    return { mapping: saved, fields: await describeFieldMapping(context(), saved) };
  });

  server.post("/wordpress-imports/:id/dry-run", guard, async (request) =>
    dryRunImport(context(), readImportId(request)),
  );

  server.post("/wordpress-imports/:id/start", guard, async (request, reply) => {
    const started = await startWordPressImport(context(), readImportId(request));
    return reply.code(202).send(started);
  });

  server.delete("/wordpress-imports/:id", guard, async (request, reply) => {
    await deleteWordPressImport(context(), readImportId(request));
    return reply.code(204).send();
  });
}

function readImportId(request: FastifyRequest): string {
  const parsed = importIdParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    throw new WordPressImportNotFoundError();
  }
  return parsed.data.id;
}
