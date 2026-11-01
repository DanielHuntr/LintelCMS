import type { EmailMessage, EmailSender } from "./email-sender.js";

/** How many messages the outbox keeps; older ones are dropped first. */
const KEPT_MESSAGES = 100;

/**
 * An email sender that sends nothing. Each message is kept in memory and written to the
 * server log, so a developer (or a test) can see exactly what would have gone out. It is
 * the default until a real sender, such as SMTP, is configured.
 */
export class DevOutbox implements EmailSender {
  private readonly messages: EmailMessage[] = [];

  constructor(private readonly log: (message: EmailMessage) => void = () => {}) {}

  /** Newest last. */
  get sent(): readonly EmailMessage[] {
    return this.messages;
  }

  async sendEmail(message: EmailMessage): Promise<void> {
    this.messages.push(message);
    if (this.messages.length > KEPT_MESSAGES) {
      this.messages.shift();
    }
    this.log(message);
  }

  clear(): void {
    this.messages.length = 0;
  }
}
