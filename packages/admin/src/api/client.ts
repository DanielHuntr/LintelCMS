/**
 * The one place the admin talks to the API. Every request sends the session cookie,
 * and every failure becomes an `ApiError` carrying the API's plain-language message.
 */

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

/** The error shape every API route uses: branch on `code`, show `message` to the person. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  /** Sent as JSON. Leave out for requests without a body. */
  body?: unknown;
  /** Extra headers, such as the setup code a first-run request has to carry. */
  headers?: Record<string, string>;
}

export async function apiRequest<Result>(path: string, options: RequestOptions = {}) {
  const hasBody = options.body !== undefined;

  const response = await fetch(`${apiUrl}${path}`, {
    method: options.method ?? "GET",
    credentials: "include",
    headers: requestHeaders(hasBody, options.headers),
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

// Only send a content type with a body: the API rejects an empty JSON body.
function requestHeaders(hasBody: boolean, extraHeaders: Record<string, string> = {}) {
  const headers = hasBody ? { "content-type": "application/json", ...extraHeaders } : extraHeaders;
  return Object.keys(headers).length > 0 ? headers : undefined;
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const details = (await response.json()) as { code?: string; message?: string };
    return new ApiError(
      response.status,
      details.code ?? "UNKNOWN",
      details.message ?? response.statusText,
    );
  } catch {
    return new ApiError(response.status, "UNKNOWN", response.statusText);
  }
}
