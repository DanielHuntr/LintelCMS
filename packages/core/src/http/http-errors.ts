import { STATUS_CODES } from "node:http";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { isValueTooLong } from "../database/database-errors.js";
import { type z, prettifyError } from "zod";

/**
 * An error that maps straight onto an HTTP response. Fastify's error handler reads
 * `statusCode` and `code`, so a thrown HttpError becomes:
 *
 *   { "statusCode": 401, "code": "NOT_SIGNED_IN", "error": "Unauthorized", "message": "..." }
 *
 * `code` is stable, for the admin to act on; `message` is for people to read.
 *
 * `details` adds more to the body when the admin needs it, such as the `fields` of an
 * entry that failed validation, or which entries still use an image. Fastify's own
 * handler would drop those, so `sendHttpErrorDetails` (registered in server.ts) sends them.
 */
export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: Readonly<Record<string, unknown>> | undefined;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class InvalidRequestError extends HttpError {
  constructor(details: string) {
    super(400, "INVALID_REQUEST", `Some of what was sent isn't right:\n${details}`);
  }
}

/** A field handle (or `slug`) and what is wrong with it, in plain English. */
export type FieldMessages = Record<string, string>;

/**
 * Validation errors about named fields: an entry's values, or a blueprint's field list.
 * The same 400 INVALID_REQUEST as any other bad request, plus a `fields` object so the
 * admin can show each message next to its input.
 */
export class InvalidFieldsError extends HttpError {
  readonly fields: FieldMessages;

  constructor(fields: FieldMessages) {
    const lines = Object.entries(fields).map(([handle, message]) => `- ${handle}: ${message}`);
    super(400, "INVALID_REQUEST", `Some fields need attention:\n${lines.join("\n")}`, { fields });
    this.fields = fields;
  }
}

/**
 * Checks a request body (or query) against a Zod schema and returns the parsed value.
 * Routes call this first, so services only ever see data of the right shape.
 */
export function parseRequest<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
): z.output<Schema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new InvalidRequestError(prettifyError(result.error));
  }
  return result.data;
}

/**
 * Fastify error handler for errors that carry `details`. Everything else is thrown on
 * to Fastify's default handler, so ordinary errors look exactly as they always have.
 */
export async function sendHttpErrorDetails(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (isValueTooLong(error)) {
    return reply.code(422).send({
      statusCode: 422,
      code: "VALUE_TOO_LONG",
      error: STATUS_CODES[422],
      message: "One of the values is too long to save here. Please shorten it and try again.",
    });
  }
  if (!(error instanceof HttpError) && (error.statusCode ?? 500) >= 500) {
    return sendUnexpectedError(error, request, reply);
  }
  if (!(error instanceof HttpError) || !error.details) {
    throw error;
  }

  return reply.code(error.statusCode).send({
    ...error.details,
    statusCode: error.statusCode,
    code: error.code,
    error: STATUS_CODES[error.statusCode] ?? "Error",
    message: error.message,
  });
}

/**
 * A bug or an outage, rather than a problem with the request. Its message can carry
 * internals (SQL, file paths, a connection string), so it goes to the server's log and the
 * response gets a plain sentence instead.
 */
function sendUnexpectedError(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  request.log.error({ err: error }, "Request failed unexpectedly");
  const statusCode = error.statusCode ?? 500;
  return reply.code(statusCode).send({
    statusCode,
    code: "INTERNAL",
    error: STATUS_CODES[statusCode] ?? "Error",
    message:
      "Something went wrong on the server. Please try again; if it keeps happening, the server's log says why.",
  });
}
