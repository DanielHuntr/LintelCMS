import { z } from "zod";
import { ProviderRequestError } from "../payment-provider.js";

/**
 * A small client for Mollie's REST API (JSON, with the API key as a bearer token). Tests
 * hand in a fake `fetch` (see ../../testing/fake-mollie.ts), so they never touch the network.
 */
export interface MollieClientOptions {
  apiKey: string;
  fetch?: typeof fetch;
  /** Defaults to https://api.mollie.com. */
  apiUrl?: string;
}

const errorSchema = z.object({ detail: z.string().optional(), title: z.string().optional() });

export class MollieClient {
  private readonly fetch: typeof fetch;
  private readonly apiUrl: string;

  constructor(private readonly options: MollieClientOptions) {
    this.fetch = options.fetch ?? globalThis.fetch;
    this.apiUrl = options.apiUrl ?? "https://api.mollie.com";
  }

  get<Result>(path: string, schema: z.ZodType<Result>): Promise<Result> {
    return this.send("GET", path, schema);
  }

  post<Result>(
    path: string,
    body: unknown,
    schema: z.ZodType<Result>,
    idempotencyKey?: string,
  ): Promise<Result> {
    return this.send("POST", path, schema, body, idempotencyKey);
  }

  delete<Result>(path: string, schema: z.ZodType<Result>): Promise<Result> {
    return this.send("DELETE", path, schema);
  }

  private async send<Result>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    schema: z.ZodType<Result>,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<Result> {
    const headers: Record<string, string> = { authorization: `Bearer ${this.options.apiKey}` };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;
    let response: Response;
    try {
      response = await this.fetch(`${this.apiUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new ProviderRequestError(`Mollie couldn't be reached (${reason}).`, 0);
    }
    const answer: unknown = await response.json().catch(() => ({}));
    if (!response.ok) {
      const parsed = errorSchema.safeParse(answer);
      throw new ProviderRequestError(
        (parsed.success && (parsed.data.detail ?? parsed.data.title)) ||
          `Mollie answered ${response.status}.`,
        response.status,
      );
    }
    const parsed = schema.safeParse(answer);
    if (!parsed.success) {
      throw new ProviderRequestError(
        `Mollie's answer to ${path} wasn't in the expected shape.`,
        502,
      );
    }
    return parsed.data;
  }
}
