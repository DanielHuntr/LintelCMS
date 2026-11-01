import { describe, expect, it } from "vitest";
import type { OrderLineRow, OrderRow } from "../orders/orders.table.js";
import { orderConfirmationEmail } from "./order-emails.js";

const paidAt = new Date("2026-11-01T10:00:00Z");

const order: OrderRow = {
  id: "00000000-0000-4000-8000-000000000001",
  tenantId: "default",
  number: 1001,
  name: "#1001",
  checkoutId: "00000000-0000-4000-8000-000000000002",
  customerId: null,
  email: "ada@example.com",
  marketId: null,
  currency: "GBP",
  shippingAddress: {
    name: "Ada Lovelace",
    company: "",
    line1: "12 St James's Square",
    line2: "",
    city: "London",
    region: "",
    postalCode: "SW1Y 4JH",
    country: "GB",
    phone: "",
  },
  shippingLine: { rateId: "standard", name: "Standard", amount: 395, taxAmount: 66 },
  discounts: [
    { code: "WELCOME10", title: "10% off your first order", amount: 450 },
    { code: "", title: "Autumn sale", amount: 100 },
  ],
  subtotalAmount: 4500,
  discountAmount: 550,
  shippingAmount: 395,
  taxAmount: 724,
  totalAmount: 4345,
  refundedAmount: 0,
  taxesIncluded: true,
  paymentStatus: "paid",
  fulfilmentStatus: "unfulfilled",
  paymentProvider: "stripe",
  providerPaymentId: null,
  stripePaymentIntentId: null,
  paidAt,
  cancelledAt: null,
  cancelReason: null,
  createdAt: paidAt,
  updatedAt: paidAt,
};

const line: OrderLineRow = {
  id: "00000000-0000-4000-8000-000000000003",
  tenantId: "default",
  orderId: order.id,
  variantId: null,
  productId: null,
  productTitle: "Linen shirt",
  variantTitle: "Medium",
  sku: null,
  imageId: null,
  quantity: 1,
  unitAmount: 4500,
  subtotalAmount: 4500,
  discountAmount: 550,
  taxAmount: 724,
  weightGrams: 0,
  fulfilledQuantity: 0,
  refundedQuantity: 0,
  position: 0,
};

describe("the order confirmation email", () => {
  it("names the discounts the customer used, in the text and the HTML", () => {
    const email = orderConfirmationEmail(order, [line], {
      shopName: "Threads",
      supportEmail: "help@threads.example",
    });

    expect(email.subject).toBe("Order #1001 confirmed");
    expect(email.to).toBe("ada@example.com");
    expect(email.text).toContain("Discount (WELCOME10, Autumn sale): −£5.50");
    expect(email.html).toContain("Discount (WELCOME10, Autumn sale)");
    expect(email.text).toContain("Total paid: £43.45");
  });
});
