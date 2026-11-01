import type { FastifyInstance } from "fastify";
import type { EmailMessage } from "./email.schema.js";

/**
 * Sends without waiting and without throwing, for emails a request shouldn't wait on or
 * fail over (invitations, password resets, security notices). A failure is logged rather
 * than shown, because answering "we couldn't email that address" would tell a stranger
 * whether an account exists, and a slow mail server shouldn't slow the request down.
 *
 * Code that must know whether an email went out (an automation's "Send an email" step,
 * `pnpm send-test-email`) awaits `server.email.send(...)` instead.
 */
export function sendEmail(server: FastifyInstance, message: EmailMessage): void {
  server.email.send(message).catch((error: unknown) => {
    server.log.error({ error, subject: message.subject }, "Sending an email failed");
  });
}
