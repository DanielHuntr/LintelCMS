import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import multipart from "@fastify/multipart";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { NoArchiveUploadedError, saveUploadedFiles } from "../archives/uploaded-archive.js";
import { requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { contentDisposition } from "../media/content-disposition.js";
import { writeExport } from "./content-export.service.js";
import type { ImportContext } from "./content-import.service.js";
import { ImportUploadNotFoundError } from "./content-transfer.errors.js";
import {
  importUploadedExport,
  keepUploadedExport,
  previewUploadedExport,
} from "./content-transfer.service.js";
import { conflictStrategies } from "./transfer-format.js";

const MAX_UPLOAD_MEGABYTES = 4096;

const exportQuerySchema = z.object({
  revisions: z.enum(["true", "false"]).default("false"),
  files: z.enum(["true", "false"]).default("true"),
});

const strategySchema = z.object({
  strategy: z.enum(conflictStrategies, { error: "Choose skip or overwrite" }).default("skip"),
});

/**
 * HTTP only. Exports and imports reach every part of the site's content, so they need
 * `content:transfer` (only Super admins have it until roles can be edited):
 *
 *   GET  /content-export                    ?revisions=&files= -> .zip (or .json without files)
 *   POST /content-imports                   multipart "file" -> 201 { uploadId, plan }
 *   GET  /content-imports/:uploadId/preview ?strategy=skip|overwrite -> plan
 *   POST /content-imports/:uploadId         { strategy } -> plan (what was done)
 */
export async function contentTransferRoutes(server: FastifyInstance) {
  await server.register(multipart, {
    limits: { fileSize: MAX_UPLOAD_MEGABYTES * 1024 * 1024, files: 1, fields: 0 },
  });
  const guard = { preHandler: requirePermission("content:transfer") };
  const context = (): ImportContext => ({
    database: server.database,
    storage: server.dataTools.storage,
  });
  const folder = () => server.dataTools.importsFolder;

  server.get("/content-export", guard, async (request, reply) => {
    const query = parseRequest(exportQuerySchema, request.query);
    const includeFiles = query.files === "true";
    await mkdir(folder(), { recursive: true });
    const path = join(folder(), `outgoing-${randomUUID()}`);
    await writeExport(context(), path, {
      includeFiles,
      includeRevisions: query.revisions === "true",
    });
    const filename = `lintel-export-${new Date().toISOString().slice(0, 10)}.${includeFiles ? "zip" : "json"}`;
    const stream = createReadStream(path);
    stream.on("close", () => void rm(path, { force: true }));
    return reply
      .type(includeFiles ? "application/zip" : "application/json")
      .header("content-disposition", contentDisposition("attachment", filename))
      .header("cache-control", "no-store")
      .send(stream);
  });

  server.post("/content-imports", guard, async (request, reply) => {
    const { files } = await saveUploadedFiles(request, folder(), MAX_UPLOAD_MEGABYTES);
    const file = files.get("file");
    if (!file) {
      throw new NoArchiveUploadedError();
    }
    try {
      return reply.code(201).send(await keepUploadedExport(context(), folder(), file.path));
    } finally {
      await rm(file.path, { force: true });
    }
  });

  server.get("/content-imports/:uploadId/preview", guard, async (request) => {
    const { strategy } = parseRequest(strategySchema, request.query);
    return previewUploadedExport(context(), folder(), readUploadId(request), strategy);
  });

  server.post("/content-imports/:uploadId", guard, async (request) => {
    const { strategy } = parseRequest(strategySchema, request.body ?? {});
    return importUploadedExport(context(), folder(), readUploadId(request), strategy);
  });
}

function readUploadId(request: FastifyRequest): string {
  const parsed = z.object({ uploadId: z.uuid() }).safeParse(request.params);
  if (!parsed.success) {
    throw new ImportUploadNotFoundError();
  }
  return parsed.data.uploadId;
}
