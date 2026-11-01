import { apiRequest } from "../api/client.js";

/** The development outbox (see packages/core/src/email). */

export interface OutboxEmail {
  id: string;
  to: string;
  subject: string;
  text: string;
  sentAt: string;
}

export const getOutbox = () =>
  apiRequest<{ enabled: boolean; messages: OutboxEmail[] }>("/email/outbox");
