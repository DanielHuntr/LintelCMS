import { apiRequest } from "../api/client.js";

/** Calls behind "Try your shop" and clearing test orders away (src/commerce/test-checkout). */

export function startTestSession() {
  return apiRequest<{ url: string; expiresAt: string }>("/shop/test-session", { method: "POST" });
}

export function getTestOrders() {
  return apiRequest<{ count: number }>("/shop/test-orders");
}

export function deleteTestOrders() {
  return apiRequest<{ deleted: number }>("/shop/test-orders", { method: "DELETE" });
}
