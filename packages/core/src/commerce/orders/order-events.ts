import type { EventDefinition } from "../../events/event-catalogue.js";
import type { FulfilmentRow, OrderRow, RefundRow } from "./orders.table.js";

/**
 * The shop's events on the bus (see src/events), declared the way any plugin declares its
 * own: types for the catalogue, and definitions for Automations. Webhooks don't offer
 * them; automations can call any address with them instead.
 *
 * Amounts are in the currency's smallest unit (pence, cents), as everywhere in the shop.
 */
export interface OrderEventData {
  id: string;
  /** How people say it: "#1001". */
  name: string;
  number: number;
  email: string;
  currency: string;
  subtotal: number;
  discount: number;
  /** Each discount used: its code ("" for automatic discounts), title and amount. */
  discounts: { code: string; title: string; amount: number }[];
  shipping: number;
  tax: number;
  total: number;
  refunded: number;
  paymentStatus: string;
  fulfilmentStatus: string;
  paymentProvider: string;
}

declare module "../../events/event-catalogue.js" {
  interface LintelEvents {
    /** A customer paid, so the order now exists. */
    "order.paid": { order: OrderEventData };
    /** Items on an order were sent. */
    "order.fulfilled": {
      order: OrderEventData;
      fulfilment: {
        id: string;
        itemCount: number;
        trackingCompany: string;
        trackingNumber: string;
        trackingUrl: string;
      };
    };
    /** Money went back to the customer (the payment service confirmed it). */
    "order.refunded": {
      order: OrderEventData;
      refund: { id: string; amount: number; currency: string; reason: string };
    };
  }
}

export function orderEventData(order: OrderRow): OrderEventData {
  return {
    id: order.id,
    name: order.name,
    number: order.number,
    email: order.email,
    currency: order.currency,
    subtotal: order.subtotalAmount,
    discount: order.discountAmount,
    discounts: order.discounts.map(({ code, title, amount }) => ({ code, title, amount })),
    shipping: order.shippingAmount,
    tax: order.taxAmount,
    total: order.totalAmount,
    refunded: order.refundedAmount,
    paymentStatus: order.paymentStatus,
    fulfilmentStatus: order.fulfilmentStatus,
    paymentProvider: order.paymentProvider,
  };
}

export function fulfilmentEventData(fulfilment: FulfilmentRow) {
  return {
    id: fulfilment.id,
    itemCount: fulfilment.lines.reduce((sum, line) => sum + line.quantity, 0),
    trackingCompany: fulfilment.trackingCompany,
    trackingNumber: fulfilment.trackingNumber,
    trackingUrl: fulfilment.trackingUrl,
  };
}

export function refundEventData(refund: RefundRow) {
  return { id: refund.id, amount: refund.amount, currency: refund.currency, reason: refund.reason };
}

const sampleOrder: OrderEventData = {
  id: "00000000-0000-4000-8000-000000000010",
  name: "#1001",
  number: 1001,
  email: "sam@example.com",
  currency: "GBP",
  subtotal: 4000,
  discount: 400,
  discounts: [{ code: "WELCOME10", title: "10% off your first order", amount: 400 }],
  shipping: 395,
  tax: 666,
  total: 3995,
  refunded: 0,
  paymentStatus: "paid",
  fulfilmentStatus: "unfulfilled",
  paymentProvider: "stripe",
};

/** What Automations shows for the shop's events, under "Shop". */
export const orderEventDefinitions: EventDefinition[] = [
  {
    name: "order.paid",
    label: "An order is paid for",
    group: "Shop",
    sampleData: { order: sampleOrder },
  },
  {
    name: "order.fulfilled",
    label: "An order is sent",
    group: "Shop",
    sampleData: {
      order: { ...sampleOrder, fulfilmentStatus: "fulfilled" },
      fulfilment: {
        id: "00000000-0000-4000-8000-000000000011",
        itemCount: 2,
        trackingCompany: "Royal Mail",
        trackingNumber: "AB123456789GB",
        trackingUrl: "",
      },
    },
  },
  {
    name: "order.refunded",
    label: "An order is refunded",
    group: "Shop",
    sampleData: {
      order: { ...sampleOrder, refunded: 3995, paymentStatus: "refunded" },
      refund: {
        id: "00000000-0000-4000-8000-000000000012",
        amount: 3995,
        currency: "GBP",
        reason: "Arrived damaged",
      },
    },
  },
];
