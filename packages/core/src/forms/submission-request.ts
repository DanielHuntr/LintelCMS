import type { FastifyInstance, FastifyRequest } from "fastify";
import { HttpError } from "../http/http-errors.js";
import { MAX_FILE_MEGABYTES } from "./form-fields.schema.js";
import type { IncomingFile } from "./submission-files.js";

/**
 * Reading a submission off the request, however it was sent: JSON (from a website's own
 * code), multipart (the embed script, and any form with a file field) or a plain HTML form
 * post. Values sent under one name more than once (checkboxes) become a list; a `[]` on the
 * end of a name, as some frameworks add, is dropped.
 */
export const SUBMISSION_LIMITS = {
  fileSize: MAX_FILE_MEGABYTES * 1024 * 1024,
  files: 20,
  fields: 300,
  fieldSize: 100 * 1024,
};

/** Where the embed script says the form was filled in; the Referer header otherwise. */
export const SOURCE_FIELD = "_source";

export class SubmissionTooLargeError extends HttpError {
  constructor() {
    super(
      413,
      "FILE_TOO_LARGE",
      `A file is bigger than ${MAX_FILE_MEGABYTES} MB, or too much was sent at once. Try smaller files.`,
    );
  }
}

export interface ReadSubmission {
  values: Record<string, unknown>;
  files: IncomingFile[];
}

/** For plain HTML form posts, which Fastify doesn't read by default. */
export function acceptUrlEncodedForms(server: FastifyInstance): void {
  server.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string", bodyLimit: 1024 * 1024 },
    (_request, body, done) => {
      const values: Record<string, unknown> = {};
      for (const [name, value] of new URLSearchParams(String(body))) {
        addValue(values, name, value);
      }
      done(null, values);
    },
  );
}

export async function readSubmission(request: FastifyRequest): Promise<ReadSubmission> {
  if (!request.isMultipart()) {
    const body = request.body;
    const values =
      typeof body === "object" && body !== null && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    return { values, files: [] };
  }

  const values: Record<string, unknown> = {};
  const files: IncomingFile[] = [];
  try {
    for await (const part of request.parts()) {
      if (part.type === "file") {
        const contents = await part.toBuffer();
        // An empty file input still sends a part, with no name and no bytes.
        if (contents.length > 0) {
          files.push({ fieldHandle: cleanName(part.fieldname), filename: part.filename, contents });
        }
      } else {
        addValue(values, part.fieldname, String(part.value));
      }
    }
  } catch (error) {
    if (
      error instanceof request.server.multipartErrors.RequestFileTooLargeError ||
      error instanceof request.server.multipartErrors.FilesLimitError ||
      error instanceof request.server.multipartErrors.FieldsLimitError
    ) {
      throw new SubmissionTooLargeError();
    }
    throw error;
  }
  return { values, files };
}

function cleanName(name: string): string {
  return name.endsWith("[]") ? name.slice(0, -2) : name;
}

function addValue(values: Record<string, unknown>, rawName: string, value: string): void {
  const name = cleanName(rawName);
  const existing = values[name];
  if (existing === undefined) {
    values[name] = value;
  } else if (Array.isArray(existing)) {
    existing.push(value);
  } else {
    values[name] = [existing, value];
  }
}
