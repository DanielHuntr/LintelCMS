import { z } from "zod";
import type { EmailDriver } from "./email-driver.js";
import { InvalidEmailError } from "./email.errors.js";
import { type EmailMessage, emailMessageSchema } from "./email.schema.js";

/**
 * What features use to send email: `await server.email.send({ to, subject, text })`.
 * It checks the message, fills in the sender from EMAIL_FROM and hands it to the driver.
 * A failure throws EmailNotSentError, whose message says what to check.
 */
export interface EmailSender {
  /** Which driver is in use, for logs and the test-email command. */
  readonly description: string;
  /** True for the outbox, where nothing really leaves the server. */
  readonly keepsInOutbox: boolean;
  send(message: EmailMessage): Promise<{ messageId?: string | undefined }>;
}

export function createEmailSender(
  driver: EmailDriver,
  options: { defaultFrom: string; keepsInOutbox?: boolean },
): EmailSender {
  return {
    description: driver.description,
    keepsInOutbox: options.keepsInOutbox ?? false,
    async send(message) {
      const parsed = emailMessageSchema.safeParse(message);
      if (!parsed.success) {
        throw new InvalidEmailError(z.prettifyError(parsed.error));
      }
      const email = parsed.data;
      return driver.send({
        from: email.from ?? options.defaultFrom,
        to: Array.isArray(email.to) ? email.to : [email.to],
        subject: email.subject,
        text: email.text,
        html: email.html,
        replyTo: email.replyTo,
      });
    },
  };
}
