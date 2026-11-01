import type { OutboxEmailDriver } from "./outbox-email-driver.js";

/** How many of the newest emails Settings → Email outbox shows. */
const MESSAGES_SHOWN = 50;

export interface OutboxResponse {
  /** False when a real driver delivers email, so there is no outbox to show. */
  enabled: boolean;
  messages: Array<{ id: string; to: string; subject: string; text: string; sentAt: string }>;
}

/** The outbox for Settings → Email outbox, newest first, so sign-in links can be followed. */
export async function describeOutbox(outbox: OutboxEmailDriver | null): Promise<OutboxResponse> {
  if (!outbox) {
    return { enabled: false, messages: [] };
  }
  const kept = await outbox.readFolder();
  return {
    enabled: true,
    messages: kept
      .slice(-MESSAGES_SHOWN)
      .reverse()
      .map((message) => ({
        id: message.id,
        to: message.to.join(", "),
        subject: message.subject,
        text: message.text,
        sentAt: message.sentAt,
      })),
  };
}
