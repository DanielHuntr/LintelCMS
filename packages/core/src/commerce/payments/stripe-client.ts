import { z } from "zod";

/**
 * A small client for the parts of Stripe's REST API the shop uses. Written by hand rather
 * than pulling in Stripe's SDK so every call is visible in one place, and so tests can hand
 * in a fake `fetch` and run with no network (see ../testing/fake-stripe.ts).
 *
 * Card details never pass through Lintel: shoppers type them into Stripe's own pages or
 * Stripe's Payment Element, which keeps the shop eligible for PCI SAQ A.
 */

export type StripeParameter =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly StripeParameter[]
  | { readonly [key: string]: StripeParameter };

export type StripeParameters = { readonly [key: string]: StripeParameter };

export interface StripeClientOptions {
  secretKey: string;
  fetch?: typeof fetch;
  /** Defaults to https://api.stripe.com. */
  apiUrl?: string;
}

/** Stripe answered with an error, or couldn't be reached. `message` is Stripe's own. */
export class StripeRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | undefined,
  ) {
    super(message);
    this.name = "StripeRequestError";
  }
}

const stripeErrorSchema = z.object({
  error: z.object({ message: z.string().optional(), code: z.string().optional() }),
});

export class StripeClient {
  private readonly fetch: typeof fetch;
  private readonly apiUrl: string;

  constructor(private readonly options: StripeClientOptions) {
    this.fetch = options.fetch ?? globalThis.fetch;
    this.apiUrl = options.apiUrl ?? "https://api.stripe.com";
  }

  get<Result>(path: string, schema: z.ZodType<Result>): Promise<Result> {
    return this.send("GET", path, schema);
  }

  /**
   * `idempotencyKey` makes a retried request safe: Stripe answers a repeat with the first
   * result instead of, say, refunding twice.
   */
  post<Result>(
    path: string,
    parameters: StripeParameters,
    schema: z.ZodType<Result>,
    idempotencyKey?: string,
  ): Promise<Result> {
    return this.send("POST", path, schema, parameters, idempotencyKey);
  }

  private async send<Result>(
    method: "GET" | "POST",
    path: string,
    schema: z.ZodType<Result>,
    parameters?: StripeParameters,
    idempotencyKey?: string,
  ): Promise<Result> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${this.options.secretKey}`,
    };
    if (parameters) headers["content-type"] = "application/x-www-form-urlencoded";
    if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;

    let response: Response;
    try {
      response = await this.fetch(`${this.apiUrl}${path}`, {
        method,
        headers,
        body: parameters ? encodeStripeParameters(parameters).toString() : undefined,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new StripeRequestError(`Stripe couldn't be reached (${reason}).`, 0, undefined);
    }

    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const parsed = stripeErrorSchema.safeParse(body);
      throw new StripeRequestError(
        parsed.success && parsed.data.error.message
          ? parsed.data.error.message
          : `Stripe answered ${response.status}.`,
        response.status,
        parsed.success ? parsed.data.error.code : undefined,
      );
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new StripeRequestError(
        `Stripe's answer to ${path} wasn't in the expected shape.`,
        502,
        undefined,
      );
    }
    return parsed.data;
  }
}

/**
 * Stripe takes form-encoded bodies with brackets for nesting:
 * `{ line_items: [{ quantity: 2 }] }` becomes `line_items[0][quantity]=2`.
 * Undefined and null values are left out.
 */
export function encodeStripeParameters(parameters: StripeParameters): URLSearchParams {
  const form = new URLSearchParams();
  const add = (key: string, value: StripeParameter): void => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((item: StripeParameter, index) => add(`${key}[${index}]`, item));
      return;
    }
    if (typeof value === "object") {
      for (const [name, item] of Object.entries(value as Record<string, StripeParameter>)) {
        add(`${key}[${name}]`, item);
      }
      return;
    }
    form.append(key, String(value));
  };
  for (const [key, value] of Object.entries(parameters)) {
    add(key, value);
  }
  return form;
}
