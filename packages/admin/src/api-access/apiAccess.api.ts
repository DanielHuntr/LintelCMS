import { apiRequest } from "../api/client.js";

/** Calls to the API's token and delivery access routes (see packages/core/src/api-tokens). */

export type TokenAccess = "read" | "readWrite";

export interface ApiToken {
  id: string;
  name: string;
  access: TokenAccess;
  tokenStart: string;
  createdAt: string;
  lastUsedAt: string | null;
  createdBy: { id: string; name: string } | null;
}

export interface CreatedApiToken {
  token: ApiToken;
  /** The whole token. The API shows it this once. */
  secret: string;
}

export interface DeliveryAccess {
  requireToken: boolean;
  allowedOrigins: string[];
}

export async function listApiTokens(): Promise<ApiToken[]> {
  const { tokens } = await apiRequest<{ tokens: ApiToken[] }>("/api-tokens");
  return tokens;
}

export function createApiToken(token: { name: string; access: TokenAccess }) {
  return apiRequest<CreatedApiToken>("/api-tokens", { method: "POST", body: token });
}

export function deleteApiToken(tokenId: string) {
  return apiRequest<void>(`/api-tokens/${tokenId}`, { method: "DELETE" });
}

export function getDeliveryAccess() {
  return apiRequest<DeliveryAccess>("/delivery-access");
}

export function updateDeliveryAccess(changes: Partial<DeliveryAccess>) {
  return apiRequest<DeliveryAccess>("/delivery-access", { method: "PUT", body: changes });
}
