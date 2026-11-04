import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { insertCheckout } from "../commerce/checkouts/checkouts.repository.js";
import { placeOrderForPayment } from "../commerce/orders/order-placement.service.js";
import {
  type AfterCommit,
  followUpPlacement,
  runAfterCommit,
} from "../commerce/payments/payment-follow-up.js";
import { recordConsents } from "../forms/consent-records.js";
import { announceFormSubmitted } from "../forms/form-submitted.js";
import { findFormRowByHandle } from "../forms/forms.repository.js";
import { withRequiredConsent } from "../forms/required-consent.js";
import { checkSubmissionValues, findSubmitterEmail } from "../forms/submission-values.js";
import { insertSubmissionRow } from "../forms/submissions.repository.js";
import { recordReceipt } from "../publishing/publishing.repository.js";
import type { PublishTargetRow } from "../publishing/publishing.table.js";
import { BRIDGE_FILE } from "./bridge-files.js";
import { signedRequestHeaders } from "./bridge-signing.js";

/**
 * Collecting what the PHP companion took in while Lintel wasn't there: form submissions
 * go into Forms, paid orders into Orders, with the same emails, events and stock changes
 * as if they had come straight to Lintel. Each item is recorded as received before it is
 * acknowledged, so asking twice never makes two orders.
 */

const submissionSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{8,64}$/),
  form: z.string(),
  values: z.record(z.string(), z.unknown()),
  receivedAt: z.string(),
  sourceUrl: z.string().default(""),
  notifiedByHost: z.boolean().default(false),
});

const lineSchema = z.object({
  variantId: z.string(),
  productId: z.string(),
  productTitle: z.string(),
  variantTitle: z.string(),
  sku: z.string().nullable(),
  imageId: z.string().nullable().default(null),
  quantity: z.number().int(),
  unitAmount: z.number().int(),
  subtotalAmount: z.number().int(),
  discountAmount: z.number().int(),
  taxAmount: z.number().int(),
  weightGrams: z.number().int(),
});

const orderSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{8,64}$/),
  provider: z.enum(["stripe", "mollie"]),
  providerPaymentId: z.string(),
  paidAt: z.string(),
  paidAmount: z.number().int(),
  paidCurrency: z.string(),
  email: z.string(),
  shippingAddress: z.object({
    name: z.string(),
    company: z.string().default(""),
    line1: z.string(),
    line2: z.string().default(""),
    city: z.string(),
    region: z.string().default(""),
    postalCode: z.string().default(""),
    country: z.string(),
    phone: z.string().default(""),
  }),
  marketId: z.string(),
  currency: z.string(),
  lines: z.array(lineSchema),
  shippingLine: z.object({
    rateId: z.string(),
    name: z.string(),
    amount: z.number().int(),
    taxAmount: z.number().int(),
  }),
  discounts: z.array(
    z.object({
      code: z.string(),
      title: z.string(),
      amount: z.number().int(),
      discountId: z.string().optional(),
      freeShipping: z.boolean().optional(),
    }),
  ),
  subtotalAmount: z.number().int(),
  discountAmount: z.number().int(),
  shippingAmount: z.number().int(),
  taxAmount: z.number().int(),
  totalAmount: z.number().int(),
  taxesIncluded: z.boolean(),
});

const pullSchema = z.object({
  submissions: z.array(z.unknown()).default([]),
  orders: z.array(z.unknown()).default([]),
});

export class BridgeUnreachableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BridgeUnreachableError";
  }
}

export async function callBridge(
  siteAddress: string,
  secret: string,
  action: "status" | "pull" | "ack",
  body = "",
  fetcher: typeof fetch = fetch,
): Promise<unknown> {
  const url = `${siteAddress.replace(/\/+$/, "")}/${BRIDGE_FILE}?action=${action}`;
  let response: Response;
  try {
    response = await fetcher(url, {
      method: action === "ack" ? "POST" : "GET",
      headers: {
        ...signedRequestHeaders(secret, action, body),
        "content-type": "application/json",
      },
      ...(action === "ack" ? { body } : {}),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new BridgeUnreachableError(
      `Lintel couldn't reach ${url} (${error instanceof Error ? error.message : String(error)}). Check the website's address in this destination's settings.`,
    );
  }
  const text = await response.text();
  if (!response.ok) {
    let message = text.slice(0, 200);
    try {
      message = String((JSON.parse(text) as { error?: unknown }).error ?? message);
    } catch {
      // Not JSON: a host's own error page. The start of it is enough.
    }
    throw new BridgeUnreachableError(`The website's form and shop helper answered: ${message}`);
  }
  return JSON.parse(text) as unknown;
}

export interface PullResult {
  submissions: number;
  orders: number;
  problems: string[];
}

export async function pullFromBridge(
  api: FastifyInstance,
  target: Pick<PublishTargetRow, "id" | "options">,
  secret: string,
  fetcher: typeof fetch = fetch,
): Promise<PullResult> {
  const siteAddress = target.options.siteAddress ?? "";
  if (!siteAddress) {
    return {
      submissions: 0,
      orders: 0,
      problems: ["Add the website's address to collect forms and orders from it."],
    };
  }
  const pulled = pullSchema.parse(await callBridge(siteAddress, secret, "pull", "", fetcher));
  const result: PullResult = { submissions: 0, orders: 0, problems: [] };
  const acknowledged = { submissions: [] as string[], orders: [] as string[] };

  for (const raw of pulled.submissions) {
    const parsed = submissionSchema.safeParse(raw);
    if (!parsed.success) continue;
    const outcome = await importSubmission(api, target.id, parsed.data);
    if (outcome === "problem") {
      result.problems.push(
        `A submission to the "${parsed.data.form}" form was kept on the website: that form no longer exists in Lintel.`,
      );
      continue;
    }
    if (outcome === "imported") result.submissions += 1;
    acknowledged.submissions.push(parsed.data.id);
  }
  for (const raw of pulled.orders) {
    const parsed = orderSchema.safeParse(raw);
    if (!parsed.success) continue;
    if (await importOrder(api, target.id, parsed.data)) result.orders += 1;
    acknowledged.orders.push(parsed.data.id);
  }
  if (acknowledged.submissions.length > 0 || acknowledged.orders.length > 0) {
    await callBridge(siteAddress, secret, "ack", JSON.stringify(acknowledged), fetcher);
  }
  return result;
}

async function importSubmission(
  api: FastifyInstance,
  targetId: string,
  submission: z.infer<typeof submissionSchema>,
): Promise<"imported" | "duplicate" | "problem"> {
  const form = await findFormRowByHandle(api.database, DEFAULT_TENANT_ID, submission.form);
  if (!form) return "problem";
  const fields = await withRequiredConsent(api.database, form);
  const checked = checkSubmissionValues(fields, submission.values);
  // The companion already checked what matters; anything Lintel reads differently is kept as sent.
  const values =
    Object.keys(checked.messages).length === 0 ? checked.values : { ...submission.values };
  const sourceUrl = /^https?:\/\//.test(submission.sourceUrl)
    ? submission.sourceUrl.slice(0, 2000)
    : null;
  // Together, so an entry that couldn't be saved isn't taken for one already collected: the
  // companion forgets what Lintel says it has.
  const row = await api.database.transaction(async (transaction) => {
    const isNew = await recordReceipt(transaction, {
      targetId,
      itemId: `submission:${submission.id}`,
      kind: "submission",
    });
    if (!isNew) return null;
    return insertSubmissionRow(transaction, {
      tenantId: DEFAULT_TENANT_ID,
      formId: form.id,
      values: values as typeof checked.values,
      submitterEmail: findSubmitterEmail(form.fields, checked.values),
      assetIds: [],
      sourceUrl,
      consents: recordConsents(
        fields,
        checked.values,
        sourceUrl,
        new Date(submission.receivedAt),
      ),
    });
  });
  if (!row) return "duplicate";
  await announceFormSubmitted(api, form, row);
  return "imported";
}

async function importOrder(
  api: FastifyInstance,
  targetId: string,
  order: z.infer<typeof orderSchema>,
): Promise<boolean> {
  const afterCommit: AfterCommit[] = [];
  const imported = await api.database.transaction(async (transaction) => {
    if (
      !(await recordReceipt(transaction, { targetId, itemId: `order:${order.id}`, kind: "order" }))
    ) {
      return false;
    }
    const checkout = await insertCheckout(transaction, {
      tenantId: DEFAULT_TENANT_ID,
      cartId: null,
      marketId: order.marketId,
      email: order.email,
      shippingAddress: order.shippingAddress,
      currency: order.currency,
      lines: order.lines.map((line) => ({ ...line, imageId: line.imageId ?? null })),
      shippingLine: order.shippingLine,
      discounts: order.discounts,
      subtotalAmount: order.subtotalAmount,
      discountAmount: order.discountAmount,
      shippingAmount: order.shippingAmount,
      taxAmount: order.taxAmount,
      totalAmount: order.totalAmount,
      taxesIncluded: order.taxesIncluded,
      taxCalculation: "manual",
      paymentProvider: order.provider,
      providerPaymentId: order.provider === "mollie" ? order.providerPaymentId : null,
      stripePaymentIntentId: order.provider === "stripe" ? order.providerPaymentId : null,
      expiresAt: new Date(order.paidAt),
    });
    const placed = await placeOrderForPayment(
      transaction,
      checkout.id,
      {
        provider: order.provider,
        paymentIntentId: order.provider === "stripe" ? order.providerPaymentId : null,
        providerPaymentId: order.providerPaymentId,
        amount: order.paidAmount,
        currency: order.paidCurrency,
      },
      new Date(order.paidAt),
    );
    followUpPlacement(api.shop, placed, afterCommit);
    return true;
  });
  await runAfterCommit(api.shop, afterCommit, `the website's order ${order.id}`);
  return imported;
}
