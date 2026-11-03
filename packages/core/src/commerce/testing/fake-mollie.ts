import type { RecordedJsonRequest } from "./fake-paypal.js";

/**
 * Mollie for tests: a `fetch` that keeps payments in memory. A test plays the shopper by
 * changing a payment's status (`fake.payments.get(id).status = "paid"`), then calls the
 * webhook with the id, as Mollie would; the shop fetches the payment back from here.
 */
export const FAKE_MOLLIE_API_KEY = "test_dHar4XY7LxsDOtmnkVtjNVWXLSlXsM";

interface FakeMolliePayment {
  id: string;
  status: string;
  /** Mollie says which on every payment. */
  mode: "live" | "test";
  /** Set by a test playing the shopper: what they chose on Mollie's page. */
  method?: string;
  amount: { currency: string; value: string };
  metadata: Record<string, unknown>;
  refunds: Array<{ id: string; status: string; amount: { currency: string; value: string } }>;
}

export class FakeMollie {
  readonly requests: RecordedJsonRequest[] = [];
  readonly payments = new Map<string, FakeMolliePayment>();
  /** The status new refunds come back with; Mollie usually says "pending" first. */
  refundStatus = "pending";
  /** The mode new payments are made in. */
  paymentMode: "live" | "test" = "live";
  /** What the methods call answers with. */
  methods: Array<{ id: string; description: string; status?: string }> = [
    { id: "ideal", description: "iDEAL", status: "activated" },
  ];
  /** Set to make the methods call fail. */
  failMethods = false;
  /** The currency of each methods call, oldest first. */
  readonly methodCurrencies: Array<string | null> = [];
  private counter = 0;

  readonly fetch: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    const text = typeof init?.body === "string" ? init.body : "";
    const body = text ? JSON.parse(text) : null;
    const request = { method: init?.method ?? "GET", path: url.pathname, body, headers };
    this.requests.push(request);
    if (url.pathname === "/v2/methods") {
      this.methodCurrencies.push(url.searchParams.get("amount[currency]"));
    }
    if (headers.get("authorization") !== `Bearer ${FAKE_MOLLIE_API_KEY}`) {
      return json(401, {
        status: 401,
        title: "Unauthorized Request",
        detail: "Missing authentication, or failed to authenticate",
      });
    }
    return this.answer(request);
  };

  requestsTo(path: string): RecordedJsonRequest[] {
    return this.requests.filter((request) => request.path === path);
  }

  private answer(request: RecordedJsonRequest): Response {
    const { method, path, body } = request;
    if (path === "/v2/methods") {
      if (this.failMethods) return json(503, { status: 503, title: "Service Unavailable" });
      return json(200, { _embedded: { methods: this.methods } });
    }
    if (path === "/v2/payments" && method === "POST" && body) {
      const id = `tr_${this.next()}`;
      const payment: FakeMolliePayment = {
        id,
        status: "open",
        mode: this.paymentMode,
        amount: body.amount as FakeMolliePayment["amount"],
        metadata: (body.metadata as Record<string, unknown>) ?? {},
        refunds: [],
      };
      this.payments.set(id, payment);
      return json(201, this.describe(payment));
    }
    const captures = /^\/v2\/payments\/([^/]+)\/captures$/.exec(path);
    if (captures && method === "POST") {
      const payment = this.payments.get(captures[1] ?? "");
      if (!payment) return notFound();
      payment.status = "paid";
      return json(201, { id: `cpt_${this.next()}` });
    }
    const refunds = /^\/v2\/payments\/([^/]+)\/refunds$/.exec(path);
    if (refunds) {
      const payment = this.payments.get(refunds[1] ?? "");
      if (!payment) return notFound();
      if (method === "POST" && body) {
        const refund = {
          id: `re_${this.next()}`,
          status: this.refundStatus,
          amount: body.amount as FakeMolliePayment["amount"],
        };
        payment.refunds.push(refund);
        return json(201, refund);
      }
      return json(200, { _embedded: { refunds: payment.refunds } });
    }
    const one = /^\/v2\/payments\/([^/]+)$/.exec(path);
    if (one) {
      const payment = this.payments.get(one[1] ?? "");
      if (!payment) return notFound();
      if (method === "DELETE") payment.status = "canceled";
      return json(200, this.describe(payment));
    }
    throw new Error(`The fake Mollie doesn't know ${method} ${path}`);
  }

  private describe(payment: FakeMolliePayment) {
    return {
      resource: "payment",
      id: payment.id,
      status: payment.status,
      mode: payment.mode,
      method: payment.method ?? null,
      amount: payment.amount,
      metadata: payment.metadata,
      _links: { checkout: { href: `https://www.mollie.com/checkout/select-method/${payment.id}` } },
    };
  }

  private next(): string {
    this.counter += 1;
    return `Fake${String(this.counter).padStart(6, "0")}`;
  }
}

function notFound(): Response {
  return json(404, { status: 404, title: "Not Found", detail: "No payment exists with token" });
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
