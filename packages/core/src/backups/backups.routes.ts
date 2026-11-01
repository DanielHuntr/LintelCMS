import { createReadStream } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import multipart from "@fastify/multipart";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { NoArchiveUploadedError, saveUploadedFiles } from "../archives/uploaded-archive.js";
import { getSignedIn, requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { contentDisposition } from "../media/content-disposition.js";
import { previewRestore, restoreBackup } from "./backup-restore.service.js";
import { readBackupSchedule, saveBackupSchedule } from "./backup-schedule.service.js";
import { BackupNotFoundError } from "./backups.errors.js";
import {
  backupIdParamsSchema,
  backupScheduleSchema,
  restoreBackupRequestSchema,
} from "./backups.schema.js";
import {
  addUploadedBackup,
  backupsContextFor,
  deleteBackup,
  findBackupArchive,
  listBackups,
  startBackup,
} from "./backups.service.js";

/** Uploaded backups can hold a whole media library. */
const MAX_UPLOAD_MEGABYTES = 4096;

/**
 * HTTP only. Backups hold everything, password hashes included, so all but the list need
 * `backups:manage` (only Super admins have it until roles can be edited):
 *
 *   GET    /backups                     (backups:read)    -> { backups, schedule }
 *   POST   /backups                     (backups:manage)  -> 202 Backup (status "running")
 *   POST   /backups/upload              (backups:manage)  multipart "file" -> 201 Backup
 *   PUT    /backups/schedule            (backups:manage)  { frequency, keep } -> schedule
 *   GET    /backups/:id/download        (backups:manage)  -> the .zip
 *   GET    /backups/:id/restore-preview (backups:manage)  -> RestoreSummary
 *   POST   /backups/:id/restore         (backups:manage)  { confirm: "RESTORE" } -> RestoreSummary
 *   DELETE /backups/:id                 (backups:manage)  -> 204
 */
export async function backupsRoutes(server: FastifyInstance) {
  await server.register(multipart, {
    limits: { fileSize: MAX_UPLOAD_MEGABYTES * 1024 * 1024, files: 1, fields: 0 },
  });

  const context = () => backupsContextFor(server);
  const manage = { preHandler: requirePermission("backups:manage") };

  server.get("/backups", { preHandler: requirePermission("backups:read") }, async () => ({
    backups: await listBackups(server.database),
    schedule: await readBackupSchedule(context()),
  }));

  server.post("/backups", manage, async (request, reply) => {
    const backup = await startBackup(context(), "manual", getSignedIn(request).user.name);
    return reply.code(202).send(backup);
  });

  server.post("/backups/upload", manage, async (request, reply) => {
    const { files } = await saveUploadedFiles(
      request,
      join(server.dataTools.backupsFolder, "uploads"),
      MAX_UPLOAD_MEGABYTES,
    );
    const file = files.get("file");
    if (!file) {
      throw new NoArchiveUploadedError();
    }
    try {
      const backup = await addUploadedBackup(context(), file.path, getSignedIn(request).user.name);
      return reply.code(201).send(backup);
    } finally {
      await rm(file.path, { force: true });
    }
  });

  server.put("/backups/schedule", manage, async (request) =>
    saveBackupSchedule(context(), parseRequest(backupScheduleSchema, request.body)),
  );

  server.get("/backups/:id/download", manage, async (request, reply) => {
    const { row, path } = await findBackupArchive(context(), readBackupId(request));
    return reply
      .type("application/zip")
      .header("content-disposition", contentDisposition("attachment", row.filename))
      .header("cache-control", "no-store")
      .send(createReadStream(path));
  });

  server.get("/backups/:id/restore-preview", manage, async (request) =>
    previewRestore(context(), readBackupId(request)),
  );

  server.post("/backups/:id/restore", manage, async (request) => {
    parseRequest(restoreBackupRequestSchema, request.body);
    return restoreBackup(context(), readBackupId(request), getSignedIn(request).user.name);
  });

  server.delete("/backups/:id", manage, async (request, reply) => {
    await deleteBackup(context(), readBackupId(request));
    return reply.code(204).send();
  });
}

function readBackupId(request: FastifyRequest): string {
  const parsed = backupIdParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    throw new BackupNotFoundError();
  }
  return parsed.data.id;
}
