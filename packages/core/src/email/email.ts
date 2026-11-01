import type { FastifyInstance } from "fastify";

/**
 * The one way Lintel sends email. Features build an `EmailMessage` and call `sendEmail`;
 * which service actually delivers it is the `EmailSender` given to `buildServer`.
 *
 * Until a real sender is configured, the `OutboxEmailSender` keeps messages in memory so
 * they can be read in the admin (Settings → Email outbox) while developing.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain text. Every message must make sense without formatting. */
  text: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

/**
 * Sends without waiting and without throwing. A failure is logged rather than shown,
 * because answering "we couldn't email that address" would tell a stranger whether an
 * account exists, and a slow mail server shouldn't slow the request down either.
 */
export function sendEmail(server: FastifyInstance, message: EmailMessage): void {
  server.email.send(message).catch((error: unknown) => {
    server.log.error({ error, subject: message.subject }, "Sending an email failed");
  });
}
