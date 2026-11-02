import { apiRequest } from "../api/client.js";

/** The development outbox (see packages/core/src/email). */

export interface OutboxEmail {
  id: string;
  to: string;
  subject: string;
  text: string;
  sentAt: string;
}

/** Whether a mail service delivers emails; false while they only reach the outbox. */
export const getEmailStatus = () => apiRequest<{ delivers: boolean }>("/email/status");

export const getOutbox = () =>
  apiRequest<{ enabled: boolean; messages: OutboxEmail[] }>("/email/outbox");
