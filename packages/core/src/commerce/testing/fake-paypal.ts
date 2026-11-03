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

interface FakePayPalOrder {
  id: string;
  /** A test plays the shopper by setting this to "APPROVED". */
  status: string;
  amount: { currency_code: string; value: string };
  captures: Array<{ id: string; status: string; amount: FakePayPalOrder["amount"] }>;
}

export class FakePayPal {
  readonly requests: RecordedJsonRequest[] = [];
  readonly orders = new Map<string, FakePayPalOrder>();
  /** What `GET /v2/payments/refunds/:id` answers, and what a capture comes back as. */
  readonly refunds = new Map<string, { id: string; status: string }>();
  refundStatus = "COMPLETED";
  captureStatus = "COMPLETED";
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
    const { method, path, body } = request;
    if (path === "/v2/checkout/orders") {
      const id = `5O${this.next()}PAYPAL`;
      const units = body?.purchase_units as
        Array<{ amount: FakePayPalOrder["amount"] }> | undefined;
      this.orders.set(id, {
        id,
        status: "PAYER_ACTION_REQUIRED",
        amount: units?.[0]?.amount ?? { currency_code: "GBP", value: "0.00" },
        captures: [],
      });
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
      const order = this.orders.get(capture[1] ?? "");
      const made = { id: `CAPTURE${this.next()}`, status: this.captureStatus };
      if (order && order.captures.length === 0) {
        order.status = "COMPLETED";
        order.captures.push({ ...made, amount: order.amount });
      }
      return json(201, {
        id: capture[1],
        status: "COMPLETED",
        purchase_units: [{ payments: { captures: [made] } }],
      });
    }
    const oneOrder = /^\/v2\/checkout\/orders\/([^/]+)$/.exec(path);
    if (oneOrder && method === "GET") {
      const order = this.orders.get(oneOrder[1] ?? "");
      if (!order) return json(404, { name: "RESOURCE_NOT_FOUND", message: "Order not found" });
      return json(200, {
        id: order.id,
        status: order.status,
        purchase_units: [{ payments: { captures: order.captures } }],
      });
    }
    const oneRefund = /^\/v2\/payments\/refunds\/([^/]+)$/.exec(path);
    if (oneRefund && method === "GET") {
      const refund = this.refunds.get(oneRefund[1] ?? "");
      return refund
        ? json(200, refund)
        : json(404, { name: "RESOURCE_NOT_FOUND", message: "Refund not found" });
    }
    if (path === "/v1/notifications/verify-webhook-signature") {
      const valid =
        body?.transmission_sig === FAKE_PAYPAL_SIGNATURE &&
        body.webhook_id === FAKE_PAYPAL.webhookId;
      return json(200, { verification_status: valid ? "SUCCESS" : "FAILURE" });
    }
    if (/^\/v2\/payments\/captures\/[^/]+\/refund$/.test(path)) {
      const refund = { id: `REFUND${this.next()}`, status: this.refundStatus };
      this.refunds.set(refund.id, refund);
      return json(201, refund);
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
