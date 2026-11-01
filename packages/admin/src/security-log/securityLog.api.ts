import { apiRequest, apiUrl } from "../api/client.js";

/** Calls to the API's security log (see packages/core/src/security-log). */

export interface SecurityEvent {
  id: string;
  kind: string;
  createdAt: string;
  actor: { id: string | null; email: string | null };
  subject: { id: string | null; name: string | null } | null;
  ipAddress: string | null;
  userAgent: string | null;
  details: Record<string, string | number | boolean | null>;
}

export interface SecurityEventPage {
  events: SecurityEvent[];
  page: number;
  perPage: number;
  total: number;
}

export function listSecurityEvents(filter: { kind?: string; page: number }) {
  const query = new URLSearchParams({ page: String(filter.page), perPage: "50" });
  if (filter.kind) query.set("kind", filter.kind);
  return apiRequest<SecurityEventPage>(`/security-log?${query}`);
}

/** A plain link downloads the file with the session cookie, like any other link to the API. */
export function securityLogExportUrl(kind: string | undefined): string {
  return `${apiUrl}/security-log/export${kind ? `?kind=${encodeURIComponent(kind)}` : ""}`;
}
