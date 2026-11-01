/**
 * PayPal for tests: a `fetch` that answers the shop's PayPal calls from memory, so tests run
 * with no network and no PayPal account. Requests are recorded with their JSON bodies.
 *
 * Webhook verification answers SUCCESS only for `FAKE_PAYPAL_SIGNATURE`, so a test can send
 * a forged event and see it refused.
 */
export const FAKE_PAYPAL = {
  clientId: "AaBbCcDdEeFfGgHhIiJjKkLl0123456789",
  clientSecret: "EeFfGgHhIiJjKkLlMmNnOoPp9876543210",
  webhookId: "8PT597110X687430LKGECATA",
} as const;

export const FAKE_PAYPAL_SIGNATURE = "fake-signature-paypal-signed";

export interface RecordedJsonRequest {
  method: string;
  path: string;
  body: Record<string, unknown> | null;
  headers: Headers;
}

export class FakePayPal {
  readonly requests: RecordedJsonRequest[] = [];
  private counter = 0;

  readonly fetch: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    const text = typeof init?.body === "string" ? init.body : "";
    const body =
      headers.get("content-type") === "application/json" && text ? JSON.parse(text) : null;
    const request = { method: init?.method ?? "GET", path: url.pathname, body, headers };
    this.requests.push(request);
    if (url.pathname === "/v1/oauth2/token") {
      const expected = `Basic ${Buffer.from(`${FAKE_PAYPAL.clientId}:${FAKE_PAYPAL.clientSecret}`).toString("base64")}`;
      return headers.get("authorization") === expected
        ? json(200, { access_token: "A21AAfaketoken", expires_in: 32400 })
        : json(401, { error: "invalid_client", error_description: "Client Authentication failed" });
    }
    if (headers.get("authorization") !== "Bearer A21AAfaketoken") {
      return json(401, { name: "AUTHENTICATION_FAILURE", message: "Authentication failed" });
    }
    return this.answer(request);
  };

  requestsTo(path: string): RecordedJsonRequest[] {
    return this.requests.filter((request) => request.path === path);
  }

  private answer(request: RecordedJsonRequest): Response {
    const { path, body } = request;
    if (path === "/v2/checkout/orders") {
      const id = `5O${this.next()}PAYPAL`;
      return json(201, {
        id,
        status: "PAYER_ACTION_REQUIRED",
        links: [
          { href: `https://api-m.sandbox.paypal.com/v2/checkout/orders/${id}`, rel: "self" },
          { href: `https://www.sandbox.paypal.com/checkoutnow?token=${id}`, rel: "payer-action" },
        ],
      });
    }
    const capture = /^\/v2\/checkout\/orders\/([^/]+)\/capture$/.exec(path);
    if (capture) {
      return json(201, {
        id: capture[1],
        status: "COMPLETED",
        purchase_units: [
          { payments: { captures: [{ id: `CAPTURE${this.next()}`, status: "COMPLETED" }] } },
        ],
      });
    }
    if (path === "/v1/notifications/verify-webhook-signature") {
      const valid =
        body?.transmission_sig === FAKE_PAYPAL_SIGNATURE &&
        body.webhook_id === FAKE_PAYPAL.webhookId;
      return json(200, { verification_status: valid ? "SUCCESS" : "FAILURE" });
    }
    if (/^\/v2\/payments\/captures\/[^/]+\/refund$/.test(path)) {
      return json(201, { id: `REFUND${this.next()}`, status: "COMPLETED" });
    }
    const webhook = /^\/v1\/notifications\/webhooks\/([^/]+)$/.exec(path);
    if (webhook) {
      return webhook[1] === FAKE_PAYPAL.webhookId
        ? json(200, { id: webhook[1], url: "https://shop.example.com/shop/paypal/webhook" })
        : json(404, { name: "INVALID_RESOURCE_ID", message: "Webhook not found" });
    }
    throw new Error(`The fake PayPal doesn't know ${request.method} ${path}`);
  }

  private next(): string {
    this.counter += 1;
    return String(this.counter).padStart(6, "0");
  }
}

/** A PayPal webhook request with the headers PayPal sends, "signed" so the fake accepts it. */
export function payPalWebhookRequest(
  event: { id: string; event_type: string; resource: Record<string, unknown> },
  signature: string = FAKE_PAYPAL_SIGNATURE,
) {
  return {
    payload: JSON.stringify(event),
    headers: {
      "content-type": "application/json",
      "paypal-auth-algo": "SHA256withRSA",
      "paypal-cert-url": "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-360caa42",
      "paypal-transmission-id": `${event.id}-transmission`,
      "paypal-transmission-sig": signature,
      "paypal-transmission-time": "2026-11-01T10:00:00Z",
    },
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
