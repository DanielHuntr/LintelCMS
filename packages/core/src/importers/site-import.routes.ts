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
import { SiteImportNotFoundError } from "./site-import.errors.js";
import {
  siteImportMappingSchema,
  siteImportParamsSchema,
  sourceParamsSchema,
} from "./site-import.schema.js";
import {
  createSiteImport,
  deleteSiteImport,
  describeSiteMappingChoices,
  dryRunSite,
  getSiteImport,
  listSiteImports,
  type SiteImportContext,
  saveSiteMapping,
  startSiteImport,
} from "./site-import.service.js";

const MAX_UPLOAD_MEGABYTES = 4096;
/** CSV and JSON exports are read whole, so they have a lower limit than zips. */
const MAX_TEXT_FILE_MEGABYTES = 64;
const MAX_FILES = 30;

/**
 * HTTP only. Imports write all over the site, so they need `content:transfer`:
 *
 *   GET    /site-imports?source=           -> { imports }
 *   POST   /site-imports/:source           multipart: "files" (CSV, JSON, HTML, any number) and/or "archive" (.zip) -> 201
 *   GET    /site-imports/:id               -> import with its report
 *   GET    /site-imports/:id/mapping       -> { import, collections, collectionFields, taxonomies, suggested }
 *   PUT    /site-imports/:id/mapping       Mapping -> { mapping }
 *   POST   /site-imports/:id/dry-run       -> report of what it would do
 *   POST   /site-imports/:id/start         -> 202, runs (or resumes) in the background
 *   DELETE /site-imports/:id               -> 204 (what it imported stays)
 *
 * :source is webflow, framer, statamic or umbraco. WordPress has /wordpress-imports.
 */
export async function siteImportRoutes(server: FastifyInstance) {
  await server.register(multipart, {
    limits: { fileSize: MAX_UPLOAD_MEGABYTES * 1024 * 1024, files: MAX_FILES + 1, fields: 0 },
  });
  const guard = { preHandler: requirePermission("content:transfer") };
  const context = (): SiteImportContext => ({
    database: server.database,
    storage: server.dataTools.storage,
    publicApiUrl: server.publicApiUrl,
    importsFolder: server.dataTools.importsFolder,
    download: { allowPrivateAddresses: server.dataTools.allowPrivateDownloads },
    tasks: server.dataTools.tasks,
  });

  server.get("/site-imports", guard, async (request) => {
    const { source } = sourceParamsSchema.partial().parse(request.query ?? {});
    return { imports: await listSiteImports(server.database, source) };
  });

  server.post("/site-imports/:source", guard, async (request, reply) => {
    const { source } = parseRequest(sourceParamsSchema, request.params);
    const folder = server.dataTools.importsFolder;
    const saved = await saveUploads(request, folder);
    try {
      if (saved.texts.length === 0 && !saved.archive) throw new NoArchiveUploadedError();
      const files = [];
      for (const file of saved.texts) {
        if ((await stat(file.path)).size > MAX_TEXT_FILE_MEGABYTES * 1024 * 1024) {
          throw new UploadTooLargeError(MAX_TEXT_FILE_MEGABYTES);
        }
        files.push({ filename: file.filename, text: await readFile(file.path, "utf8") });
      }
      let archiveFile: string | null = null;
      if (saved.archive) {
        archiveFile = `${source}-site-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.zip`;
        await rename(saved.archive.path, join(folder, archiveFile));
      }
      try {
        const created = await createSiteImport(context(), {
          source,
          filename: saved.archive?.filename ?? saved.texts[0]?.filename ?? source,
          files,
          archiveFile,
          startedBy: getSignedIn(request).user.id,
        });
        return reply.code(201).send(created);
      } catch (error) {
        if (archiveFile) await rm(join(folder, archiveFile), { force: true });
        throw error;
      }
    } finally {
      await Promise.all(saved.all.map((path) => rm(path, { force: true })));
    }
  });

  server.get("/site-imports/:id", guard, async (request) =>
    getSiteImport(server.database, readImportId(request)),
  );

  server.get("/site-imports/:id/mapping", guard, async (request) =>
    describeSiteMappingChoices(context(), readImportId(request)),
  );

  server.put("/site-imports/:id/mapping", guard, async (request) => {
    const mapping = parseRequest(siteImportMappingSchema, request.body ?? {});
    return { mapping: await saveSiteMapping(context(), readImportId(request), mapping) };
  });

  server.post("/site-imports/:id/dry-run", guard, async (request) =>
    dryRunSite(context(), readImportId(request)),
  );

  server.post("/site-imports/:id/start", guard, async (request, reply) => {
    const started = await startSiteImport(context(), readImportId(request));
    return reply.code(202).send(started);
  });

  server.delete("/site-imports/:id", guard, async (request, reply) => {
    await deleteSiteImport(context(), readImportId(request));
    return reply.code(204).send();
  });
}

/** The uploads: text files under "files" (any number) and a zip under "archive". */
async function saveUploads(request: FastifyRequest, folder: string) {
  const { files } = await saveUploadedFiles(request, folder, MAX_UPLOAD_MEGABYTES);
  const texts = [...files.entries()]
    .filter(([fieldName]) => fieldName.startsWith("files"))
    .map(([, file]) => file)
    .slice(0, MAX_FILES);
  return {
    texts,
    archive: files.get("archive"),
    all: [...files.values()].map((file) => file.path),
  };
}

function readImportId(request: FastifyRequest): string {
  const parsed = siteImportParamsSchema.safeParse(request.params);
  if (!parsed.success) throw new SiteImportNotFoundError();
  return parsed.data.id;
}
