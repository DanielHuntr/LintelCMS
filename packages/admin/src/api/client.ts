/**
 * The one place the admin talks to the API. Every request sends the session cookie,
 * and every failure becomes an `ApiError` carrying the API's plain-language message.
 */

/** Exported for the few requests `apiRequest` can't make, such as uploads that report progress. */
export const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

/** The error shape every API route uses: branch on `code`, show `message` to the person. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /** Anything else in the error body, such as `usedBy` on a 409 ASSET_IN_USE. */
    readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  /** Sent as JSON. Leave out for requests without a body. */
  body?: unknown;
}

export async function apiRequest<Result>(path: string, options: RequestOptions = {}) {
  const hasBody = options.body !== undefined;

  const response = await fetch(`${apiUrl}${path}`, {
    method: options.method ?? "GET",
    credentials: "include",
    // Only send a content type with a body: the API rejects an empty JSON body.
    headers: hasBody ? { "content-type": "application/json" } : undefined,
    body: hasBody ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    throw await toApiError(response);
  }

  if (response.status === 204) {
    return undefined as Result;
  }

  return (await response.json()) as Result;
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  return apiErrorFromBody(response.status, response.statusText, body);
}

/** Builds an ApiError from a parsed error body, which may be missing or not what we expect. */
export function apiErrorFromBody(status: number, statusText: string, body: unknown): ApiError {
  if (typeof body !== "object" || body === null) {
    return new ApiError(status, "UNKNOWN", statusText);
  }
  const { code, message, ...rest } = body as Record<string, unknown>;
  // statusCode and error repeat what the response already says; keep only the extras.
  const details = Object.fromEntries(
    Object.entries(rest).filter(([key]) => key !== "statusCode" && key !== "error"),
  );
  return new ApiError(
    status,
    typeof code === "string" ? code : "UNKNOWN",
    typeof message === "string" ? message : statusText,
    details,
  );
}
