/**
 * The smallest thing that sends email, so features can send without knowing how.
 * Automations use it for their "Send an email" step. A real mail driver (SMTP, a
 * provider's API) implements the same interface and is passed to `buildServer`.
 */
export interface EmailMessage {
  to: string[];
  subject: string;
  /** Plain text. */
  text: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

/** Until a mail driver is set up, email is written to the server log instead of sent. */
export class LoggingEmailSender implements EmailSender {
  constructor(private readonly log: (message: string, details: EmailMessage) => void) {}

  async send(message: EmailMessage): Promise<void> {
    this.log(`Email to ${message.to.join(", ")}: ${message.subject}`, message);
  }
}

/** Keeps what would have been sent, for tests. */
export class RecordingEmailSender implements EmailSender {
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }
}
