import { createTransport, type Transporter } from "nodemailer";
import type { EmailDriver } from "./email-driver.js";
import { EmailNotSentError } from "./email.errors.js";
import type { OutgoingEmail } from "./email.schema.js";

export interface SmtpOptions {
  host: string;
  port: number;
  /** Encrypt from the start (port 465). Otherwise STARTTLS is used when the server offers it. */
  secure: boolean;
  user?: string | undefined;
  password?: string | undefined;
}

/** Sends through any SMTP server: a mail host, Amazon SES, Mailgun, Gmail, Mailpit. */
export class SmtpEmailDriver implements EmailDriver {
  readonly description: string;
  private readonly transport: Transporter;

  constructor(options: SmtpOptions) {
    this.description = `SMTP (${options.host}:${options.port})`;
    this.transport = createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      ...(options.user ? { auth: { user: options.user, pass: options.password ?? "" } } : {}),
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
    });
  }

  async send(email: OutgoingEmail) {
    try {
      const info: { messageId?: string } = await this.transport.sendMail({
        from: email.from,
        to: email.to,
        subject: email.subject,
        text: email.text,
        ...(email.html ? { html: email.html } : {}),
        ...(email.replyTo ? { replyTo: email.replyTo } : {}),
      });
      return { messageId: info.messageId };
    } catch (error) {
      throw new EmailNotSentError(this.description, explainSmtpError(error));
    }
  }

  close(): void {
    this.transport.close();
  }
}

function explainSmtpError(error: unknown): string {
  const code = error instanceof Error && "code" in error ? String(error.code) : "";
  if (code === "EAUTH") {
    return "the server refused the user name or password. Check SMTP_USER and SMTP_PASSWORD.";
  }
  if (code === "ECONNECTION" || code === "ETIMEDOUT" || code === "EDNS") {
    return "Lintel couldn't reach the mail server. Check SMTP_HOST and SMTP_PORT, and that this server may connect out on that port.";
  }
  if (code === "ESOCKET" || code === "ETLS") {
    return "the secure connection failed. Port 465 needs SMTP_SECURE=true; 587 and 25 need it false.";
  }
  return error instanceof Error ? error.message : String(error);
}
