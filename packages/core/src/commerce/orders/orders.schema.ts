import { z } from "zod";
import { addressSchema } from "../customers/address.schema.js";
import { minorAmountSchema } from "../money/money.js";
import { orderDisplayStatuses } from "./order-statuses.js";
import { fulfilmentStatuses, paymentStatuses, refundStatuses } from "./orders.table.js";

export const listOrdersQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  paymentStatus: z.enum(paymentStatuses).optional(),
  fulfilmentStatus: z.enum(fulfilmentStatuses).optional(),
  cancelled: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  customerId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

const lineQuantitiesSchema = z
  .array(
    z.object({
      orderLineId: z.uuid({ error: "Each line needs its order line id" }),
      quantity: z.number().int().min(1, { error: "Quantities should be at least 1" }),
    }),
  )
  .max(200);

/**
 * `POST /shop/orders/:id/refunds`. With `amount` left out, the lines' share of the order is
 * refunded (their price after discounts, plus tax when it was added on top).
 */
export const refundOrderRequestSchema = z
  .object({
    amount: minorAmountSchema.min(1, { error: "Refund at least the smallest amount" }).optional(),
    lines: lineQuantitiesSchema.default([]),
    reason: z.string().trim().max(500).default(""),
    restock: z.boolean().default(false),
    notifyCustomer: z.boolean().default(true),
  })
  .refine((refund) => refund.amount !== undefined || refund.lines.length > 0, {
    error: "Say how much to refund, or which items",
  });

/** `POST /shop/orders/:id/fulfilments`. With no lines, everything still to send. */
export const fulfilOrderRequestSchema = z.object({
  lines: lineQuantitiesSchema.default([]),
  trackingCompany: z.string().trim().max(100).default(""),
  trackingNumber: z.string().trim().max(100).default(""),
  trackingUrl: z
    .union([
      z.literal(""),
      z.url({ protocol: /^https?$/, error: "The tracking link should start with https://" }),
    ])
    .default(""),
  notifyCustomer: z.boolean().default(true),
});

/** `POST /shop/orders/:id/cancel` */
export const cancelOrderRequestSchema = z.object({
  reason: z.string().trim().max(500).default(""),
  refund: z.boolean().default(true),
  restock: z.boolean().default(true),
  notifyCustomer: z.boolean().default(true),
});

/** `POST /shop/orders/:id/notes` */
export const addOrderNoteRequestSchema = z.object({
  message: z
    .string({ error: "Please write the note" })
    .trim()
    .min(1, { error: "Please write the note" })
    .max(5000),
});

const moneySchema = z.object({ amount: z.number().int(), currency: z.string() });

export const orderSummarySchema = z.object({
  id: z.uuid(),
  number: z.number().int(),
  name: z.string(),
  email: z.string(),
  customerName: z.string(),
  status: z.enum(orderDisplayStatuses),
  paymentStatus: z.enum(paymentStatuses),
  fulfilmentStatus: z.enum(fulfilmentStatuses),
  cancelled: z.boolean(),
  total: moneySchema,
  itemCount: z.number().int(),
  createdAt: z.iso.datetime(),
});

export const orderSchema = orderSummarySchema.extend({
  customerId: z.uuid().nullable(),
  shippingAddress: addressSchema,
  shippingLine: z.object({ name: z.string(), amount: moneySchema }),
  subtotal: moneySchema,
  discount: moneySchema,
  shipping: moneySchema,
  tax: moneySchema,
  refunded: moneySchema,
  taxesIncluded: z.boolean(),
  cancelledAt: z.iso.datetime().nullable(),
  cancelReason: z.string().nullable(),
  /** The most that can still be refunded, counting refunds on their way. */
  refundable: moneySchema,
  lines: z.array(
    z.object({
      id: z.uuid(),
      productId: z.uuid().nullable(),
      variantId: z.uuid().nullable(),
      productTitle: z.string(),
      variantTitle: z.string(),
      sku: z.string().nullable(),
      imageId: z.uuid().nullable(),
      quantity: z.number().int(),
      unitPrice: moneySchema,
      subtotal: moneySchema,
      discount: moneySchema,
      tax: moneySchema,
      fulfilledQuantity: z.number().int(),
      refundedQuantity: z.number().int(),
      unfulfilledQuantity: z.number().int(),
    }),
  ),
  refunds: z.array(
    z.object({
      id: z.uuid(),
      amount: moneySchema,
      status: z.enum(refundStatuses),
      reason: z.string(),
      createdAt: z.iso.datetime(),
    }),
  ),
  fulfilments: z.array(
    z.object({
      id: z.uuid(),
      lines: z.array(z.object({ orderLineId: z.uuid(), quantity: z.number().int() })),
      trackingCompany: z.string(),
      trackingNumber: z.string(),
      trackingUrl: z.string(),
      createdAt: z.iso.datetime(),
    }),
  ),
  timeline: z.array(
    z.object({
      id: z.uuid(),
      kind: z.string(),
      message: z.string(),
      createdAt: z.iso.datetime(),
    }),
  ),
  stripePaymentUrl: z.string().nullable(),
});

export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
export type RefundOrderRequest = z.infer<typeof refundOrderRequestSchema>;
export type FulfilOrderRequest = z.infer<typeof fulfilOrderRequestSchema>;
export type CancelOrderRequest = z.infer<typeof cancelOrderRequestSchema>;
export type OrderSummary = z.infer<typeof orderSummarySchema>;
export type Order = z.infer<typeof orderSchema>;
