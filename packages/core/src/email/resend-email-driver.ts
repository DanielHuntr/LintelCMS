import type { EmailDriver } from "./email-driver.js";
import type { OutgoingEmail } from "./email.schema.js";
import { type Fetch, postEmailRequest } from "./http-email-request.js";

/** Sends through Resend's HTTP API (https://resend.com). */
export class ResendEmailDriver implements EmailDriver {
  readonly description = "Resend";

  constructor(
    private readonly apiKey: string,
    private readonly fetch: Fetch = globalThis.fetch,
  ) {}

  async send(email: OutgoingEmail) {
    const answer = await postEmailRequest({
      driver: this.description,
      fetch: this.fetch,
      url: "https://api.resend.com/emails",
      headers: { authorization: `Bearer ${this.apiKey}` },
      body: {
        from: email.from,
        to: email.to,
        subject: email.subject,
        text: email.text,
        ...(email.html ? { html: email.html } : {}),
        ...(email.replyTo ? { reply_to: email.replyTo } : {}),
      },
      errorMessageField: "message",
    });
    return { messageId: typeof answer.id === "string" ? answer.id : undefined };
  }
}
