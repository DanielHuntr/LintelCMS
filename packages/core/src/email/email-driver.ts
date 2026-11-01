import type { OutgoingEmail } from "./email.schema.js";

/**
 * How an email leaves Lintel. Each driver is one small class: SMTP, an HTTP sending service
 * (Resend, Postmark) or the outbox that keeps emails on disk in development. Features never
 * see a driver; they call `server.email.send(...)` (see email.service.ts).
 */
export interface EmailDriver {
  /** Shown in logs and in `pnpm send-test-email`, such as "SMTP (smtp.example.com)". */
  readonly description: string;
  /** Resolves with the sending service's id for the email, when it gives one. */
  send(email: OutgoingEmail): Promise<{ messageId?: string | undefined }>;
}
