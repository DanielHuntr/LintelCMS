import { randomUUID } from "node:crypto";
import type { EmailMessage, EmailSender } from "./email.js";

export interface OutboxEmail extends EmailMessage {
  id: string;
  sentAt: Date;
}

/** Plenty to follow a sign-up or a password reset, without growing forever. */
const MESSAGES_KEPT = 50;

/**
 * Keeps sent messages in memory instead of delivering them, newest first, so links in
 * invitations and reset emails can be followed on a computer with no mail server.
 * Restarting the server empties it.
 */
export class OutboxEmailSender implements EmailSender {
  private readonly messages: OutboxEmail[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.messages.unshift({ ...message, id: randomUUID(), sentAt: new Date() });
    this.messages.length = Math.min(this.messages.length, MESSAGES_KEPT);
  }

  list(): readonly OutboxEmail[] {
    return this.messages;
  }

  /** The newest message to an address; tests use it to follow links. */
  latestTo(email: string): OutboxEmail | undefined {
    return this.messages.find((message) => message.to === email);
  }
}
