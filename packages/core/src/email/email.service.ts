import type { OutboxEmailSender } from "./outbox-email-sender.js";

export interface OutboxResponse {
  /** False when a real sender delivers email, so there is no outbox to show. */
  enabled: boolean;
  messages: Array<{ id: string; to: string; subject: string; text: string; sentAt: string }>;
}

export function describeOutbox(outbox: OutboxEmailSender | null): OutboxResponse {
  if (!outbox) {
    return { enabled: false, messages: [] };
  }
  return {
    enabled: true,
    messages: outbox.list().map((message) => ({
      id: message.id,
      to: message.to,
      subject: message.subject,
      text: message.text,
      sentAt: message.sentAt.toISOString(),
    })),
  };
}
