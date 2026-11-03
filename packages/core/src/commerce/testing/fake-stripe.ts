import { computeStripeSignature } from "../payments/stripe-signature.js";

/**
 * Stripe for tests: a `fetch` that answers the shop's Stripe calls from memory, so tests
 * run with no network and no Stripe account. Every request is recorded with its
 * form-encoded body decoded, so a test can check exactly what would have been sent.
 *
 *   const stripe = new FakeStripe();
 *   buildServer({ ..., commerce: { stripeFetch: stripe.fetch, environment: FAKE_STRIPE_ENVIRONMENT } });
 *
 * Tax calculations charge `taxRate` percent of each line and of shipping.
 */
export const FAKE_STRIPE_ENVIRONMENT = {
  STRIPE_SECRET_KEY: "sk_test_fakekey4242",
  STRIPE_PUBLISHABLE_KEY: "pk_test_fakekey4242",
  STRIPE_WEBHOOK_SECRET: "whsec_testsigningsecret",
} as const;

export interface RecordedStripeRequest {
  method: string;
  path: string;
  form: URLSearchParams;
  idempotencyKey: string | null;
}

export class FakeStripe {
  readonly requests: RecordedStripeRequest[] = [];
  taxRate = 20;
  /** The status new refunds come back with; Stripe often says "pending" first. */
  refundStatus = "succeeded";
  /** Set to make the next request to a path fail with Stripe's error shape. */
  failNext: { path: string; status: number; message: string } | null = null;
  /** The account's Payment Method Configurations, as Stripe lists them. */
  paymentMethodConfigurations: Array<Record<string, unknown>> = [];
  private counter = 0;

  readonly fetch: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const form = new URLSearchParams(typeof init?.body === "string" ? init.body : "");
    const headers = new Headers(init?.headers);
    const request = {
      method: init?.method ?? "GET",
      path: url.pathname,
      form,
      idempotencyKey: headers.get("idempotency-key"),
    };
    this.requests.push(request);
    if (headers.get("authorization") !== `Bearer ${FAKE_STRIPE_ENVIRONMENT.STRIPE_SECRET_KEY}`) {
      return json(401, {
        error: { message: "Invalid API Key provided", type: "invalid_request_error" },
      });
    }
    if (this.failNext && url.pathname.startsWith(this.failNext.path)) {
      const failure = this.failNext;
      this.failNext = null;
      return json(failure.status, { error: { message: failure.message } });
    }
    return json(200, this.answer(request));
  };

  /** Requests to one endpoint, oldest first. */
  requestsTo(path: string): RecordedStripeRequest[] {
    return this.requests.filter((request) => request.path === path);
  }

  private answer(request: RecordedStripeRequest): Record<string, unknown> {
    const { path, form } = request;
    if (path === "/v1/account") {
      return { id: "acct_test123", settings: { dashboard: { display_name: "Test shop" } } };
    }
    if (path === "/v1/checkout/sessions") {
      const id = `cs_test_${this.next()}`;
      return {
        id,
        url: `https://checkout.stripe.com/c/pay/${id}`,
        expires_at: Number(form.get("expires_at")),
      };
    }
    if (path.endsWith("/expire")) {
      return { id: path.split("/")[4] };
    }
    if (path === "/v1/payment_intents") {
      const id = `pi_test_${this.next()}`;
      return { id, client_secret: `${id}_secret_${this.next()}` };
    }
    if (path.endsWith("/cancel")) {
      return { id: path.split("/")[3] };
    }
    if (path === "/v1/payment_method_configurations") {
      return { object: "list", has_more: false, data: this.paymentMethodConfigurations };
    }
    if (path === "/v1/coupons") {
      return { id: `coupon_${this.next()}` };
    }
    if (path === "/v1/refunds") {
      return {
        id: `re_test_${this.next()}`,
        amount: Number(form.get("amount")),
        currency: "gbp",
        status: this.refundStatus,
        payment_intent: form.get("payment_intent"),
        metadata: {
          lintel_order_id: form.get("metadata[lintel_order_id]"),
          lintel_refund_id: form.get("metadata[lintel_refund_id]"),
        },
      };
    }
    if (path === "/v1/tax/calculations") {
      return this.taxCalculation(form);
    }
    if (path === "/v1/tax/transactions/create_from_calculation") {
      return { id: `tax_txn_${this.next()}` };
    }
    throw new Error(`The fake Stripe doesn't know ${request.method} ${path}`);
  }

  private taxCalculation(form: URLSearchParams): Record<string, unknown> {
    const inclusive = form.get("line_items[0][tax_behavior]") === "inclusive";
    const tax = (amount: number) =>
      inclusive
        ? Math.round(amount - amount / (1 + this.taxRate / 100))
        : Math.round((amount * this.taxRate) / 100);
    const lines: Array<{ reference: string; amount_tax: number }> = [];
    for (let index = 0; form.has(`line_items[${index}][amount]`); index++) {
      lines.push({
        reference: form.get(`line_items[${index}][reference]`) ?? "",
        amount_tax: tax(Number(form.get(`line_items[${index}][amount]`))),
      });
    }
    const shippingTax = tax(Number(form.get("shipping_cost[amount]") ?? 0));
    const total = lines.reduce((sum, line) => sum + line.amount_tax, 0) + shippingTax;
    return {
      id: `taxcalc_${this.next()}`,
      tax_amount_exclusive: inclusive ? 0 : total,
      tax_amount_inclusive: inclusive ? total : 0,
      line_items: { data: lines },
      shipping_cost: { amount_tax: shippingTax },
    };
  }

  private next(): string {
    this.counter += 1;
    return String(this.counter).padStart(6, "0");
  }
}

/** A webhook request exactly as Stripe would send it, signed with the test signing secret. */
export function signedStripeWebhook(
  event: { id: string; type: string; data: { object: Record<string, unknown> } },
  signedAt: Date,
  secret: string = FAKE_STRIPE_ENVIRONMENT.STRIPE_WEBHOOK_SECRET,
): { payload: string; headers: Record<string, string> } {
  const payload = JSON.stringify({ object: "event", livemode: false, ...event });
  const timestamp = Math.floor(signedAt.getTime() / 1000);
  return {
    payload,
    headers: {
      "content-type": "application/json",
      "stripe-signature": `t=${timestamp},v1=${computeStripeSignature(payload, timestamp, secret)}`,
    },
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
