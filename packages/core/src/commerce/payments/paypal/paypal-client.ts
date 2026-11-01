import { z } from "zod";
import { ProviderRequestError } from "../payment-provider.js";

/**
 * A small client for PayPal's REST API: an OAuth token from the app's client id and secret,
 * then JSON requests with it. Tests hand in a fake `fetch` (see ../../testing/fake-paypal.ts),
 * so they never touch the network.
 */
export interface PayPalClientOptions {
  clientId: string;
  clientSecret: string;
  environment: "sandbox" | "live";
  fetch?: typeof fetch;
  /** Overrides the address picked by `environment`. */
  apiUrl?: string;
}

export const PAYPAL_API_URLS = {
  sandbox: "https://api-m.sandbox.paypal.com",
  live: "https://api-m.paypal.com",
} as const;

const tokenSchema = z.object({ access_token: z.string(), expires_in: z.number().optional() });

const errorSchema = z.object({
  message: z.string().optional(),
  error_description: z.string().optional(),
  details: z.array(z.object({ description: z.string().optional() })).optional(),
});

export class PayPalClient {
  private readonly fetch: typeof fetch;
  private readonly apiUrl: string;
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private readonly options: PayPalClientOptions) {
    this.fetch = options.fetch ?? globalThis.fetch;
    this.apiUrl = options.apiUrl ?? PAYPAL_API_URLS[options.environment];
  }

  get<Result>(path: string, schema: z.ZodType<Result>): Promise<Result> {
    return this.send("GET", path, schema);
  }

  /** `requestId` (PayPal-Request-Id) makes a retried request safe: PayPal answers it once. */
  post<Result>(
    path: string,
    body: unknown,
    schema: z.ZodType<Result>,
    requestId?: string,
  ): Promise<Result> {
    return this.send("POST", path, schema, body, requestId);
  }

  /** Asks for a token; also how "Check connection" proves the credentials work. */
  async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now()) {
      return this.token.value;
    }
    const basic = Buffer.from(`${this.options.clientId}:${this.options.clientSecret}`).toString(
      "base64",
    );
    const response = await this.call(`${this.apiUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        authorization: `Basic ${basic}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    const token = tokenSchema.parse(await this.read(response, "/v1/oauth2/token"));
    // Renewed a minute early, so a token never runs out halfway through a request.
    const lifetime = Math.max(0, (token.expires_in ?? 300) - 60) * 1000;
    this.token = { value: token.access_token, expiresAt: Date.now() + lifetime };
    return token.access_token;
  }

  private async send<Result>(
    method: "GET" | "POST",
    path: string,
    schema: z.ZodType<Result>,
    body?: unknown,
    requestId?: string,
  ): Promise<Result> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${await this.accessToken()}`,
      "content-type": "application/json",
      prefer: "return=representation",
    };
    if (requestId) headers["paypal-request-id"] = requestId;
    const response = await this.call(`${this.apiUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const parsed = schema.safeParse(await this.read(response, path));
    if (!parsed.success) {
      throw new ProviderRequestError(
        `PayPal's answer to ${path} wasn't in the expected shape.`,
        502,
      );
    }
    return parsed.data;
  }

  private async call(url: string, init: RequestInit): Promise<Response> {
    try {
      return await this.fetch(url, init);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new ProviderRequestError(`PayPal couldn't be reached (${reason}).`, 0);
    }
  }

  private async read(response: Response, path: string): Promise<unknown> {
    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const parsed = errorSchema.safeParse(body);
      const message = parsed.success
        ? (parsed.data.details?.[0]?.description ??
          parsed.data.message ??
          parsed.data.error_description)
        : undefined;
      throw new ProviderRequestError(
        message ?? `PayPal answered ${response.status} to ${path}.`,
        response.status,
      );
    }
    return body;
  }
}
