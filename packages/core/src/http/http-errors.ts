import { type z, prettifyError } from "zod";

/**
 * An error that maps straight onto an HTTP response. Fastify's error handler reads
 * `statusCode` and `code`, so a thrown HttpError becomes:
 *
 *   { "statusCode": 401, "code": "NOT_SIGNED_IN", "error": "Unauthorized", "message": "..." }
 *
 * `code` is stable, for the admin to act on; `message` is for people to read.
 */
export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class InvalidRequestError extends HttpError {
  constructor(details: string) {
    super(400, "INVALID_REQUEST", `Some of what was sent isn't right:\n${details}`);
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
