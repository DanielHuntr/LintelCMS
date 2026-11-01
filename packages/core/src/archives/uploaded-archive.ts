import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import type { FastifyRequest } from "fastify";
import { HttpError } from "../http/http-errors.js";

/**
 * Saves the file in a multipart upload straight to disk, without holding it in memory:
 * backups and site exports can be many gigabytes. The route's plugin registers
 * @fastify/multipart with the size limit it wants.
 */
export interface SavedUpload {
  path: string;
  filename: string;
}

export class NoArchiveUploadedError extends HttpError {
  constructor() {
    super(400, "NO_FILE", "Choose a file to upload.");
  }
}

export class UploadTooLargeError extends HttpError {
  constructor(limitInMegabytes: number) {
    super(
      413,
      "FILE_TOO_LARGE",
      `This file is bigger than ${limitInMegabytes.toLocaleString("en")} MB, the most Lintel accepts here. Use the lintel command line tool for bigger files.`,
    );
  }
}

/** Saves fields named `fieldName` only; returns the other text fields too. */
export async function saveUploadedFiles(
  request: FastifyRequest,
  folder: string,
  limitInMegabytes: number,
): Promise<{ files: Map<string, SavedUpload>; fields: Map<string, string> }> {
  if (!request.isMultipart()) {
    throw new NoArchiveUploadedError();
  }
  await mkdir(folder, { recursive: true });
  const files = new Map<string, SavedUpload>();
  const fields = new Map<string, string>();
  try {
    for await (const part of request.parts()) {
      if (part.type === "field") {
        fields.set(part.fieldname, String(part.value));
        continue;
      }
      const path = join(folder, `upload-${randomUUID()}`);
      await pipeline(part.file, createWriteStream(path));
      if (part.file.truncated) {
        await rm(path, { force: true });
        throw new UploadTooLargeError(limitInMegabytes);
      }
      files.set(part.fieldname, { path, filename: part.filename });
    }
  } catch (error) {
    await Promise.all([...files.values()].map((file) => rm(file.path, { force: true })));
    if (error instanceof request.server.multipartErrors.RequestFileTooLargeError) {
      throw new UploadTooLargeError(limitInMegabytes);
    }
    throw error;
  }
  return { files, fields };
}
