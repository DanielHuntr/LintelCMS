import { vi } from "vitest";

type Responder = (request: { method: string; url: URL; body: unknown }) => unknown;

/**
 * Stands in for the API in tests. Give it a function from (method, path) to a JSON body;
 * every call is recorded so tests can check what was sent. Throwing a `Response` from the
 * responder sends that response instead (for errors).
 */
export function mockApi(respond: Responder) {
  const calls: Array<{ method: string; url: URL; body: unknown }> = [];

  const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : undefined;
    const request = { method, url, body };
    calls.push(request);
    try {
      const result = respond(request);
      return result === undefined
        ? new Response(null, { status: 204 })
        : new Response(JSON.stringify(result), { status: 200 });
    } catch (thrown) {
      if (thrown instanceof Response) return thrown;
      throw thrown;
    }
  });

  return { calls, fetchMock };
}

/** An API error response in the contract's shape. */
export function apiErrorResponse(
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string>,
): Response {
  return new Response(JSON.stringify({ statusCode: status, code, error: code, message, fields }), {
    status,
  });
}
