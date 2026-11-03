import { apiRequest } from "@lintel/admin/plugin";
import type { ConnectionSummary, NewsletterList, ProviderId } from "../server/newsletter.schema.js";

/** Calls to the add-on's own routes (see src/server/newsletter.routes.ts). */

export type { ConnectionSummary, NewsletterList, ProviderId };

export interface ConnectionChanges {
  provider: ProviderId;
  /** Left out to keep the saved key. */
  apiKey?: string;
  listId: string;
  doubleOptIn: boolean;
  brevoTemplateId: number | null;
  brevoConfirmUrl: string;
}

export const connectionKey = ["newsletter", "connection"] as const;

export const readConnection = () => apiRequest<ConnectionSummary>("/newsletter/connection");

export const saveConnection = (changes: ConnectionChanges) =>
  apiRequest<ConnectionSummary>("/newsletter/connection", { method: "PUT", body: changes });

export const disconnect = () => apiRequest<void>("/newsletter/connection", { method: "DELETE" });

export async function findLists(provider: ProviderId, apiKey: string): Promise<NewsletterList[]> {
  const body = apiKey ? { provider, apiKey } : { provider };
  return (
    await apiRequest<{ lists: NewsletterList[] }>("/newsletter/lists", { method: "POST", body })
  ).lists;
}

export const PROVIDER_NAMES: Record<ProviderId, string> = {
  mailchimp: "Mailchimp",
  brevo: "Brevo",
};
