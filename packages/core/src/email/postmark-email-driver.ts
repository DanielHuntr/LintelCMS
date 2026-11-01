import type { EmailDriver } from "./email-driver.js";
import type { OutgoingEmail } from "./email.schema.js";
import { type Fetch, postEmailRequest } from "./http-email-request.js";

/** Sends through Postmark's HTTP API (https://postmarkapp.com). */
export class PostmarkEmailDriver implements EmailDriver {
  readonly description = "Postmark";

  constructor(
    private readonly serverToken: string,
    /** Postmark keeps transactional and broadcast email apart; "outbound" is the default stream. */
    private readonly messageStream = "outbound",
    private readonly fetch: Fetch = globalThis.fetch,
  ) {}

  async send(email: OutgoingEmail) {
    const answer = await postEmailRequest({
      driver: this.description,
      fetch: this.fetch,
      url: "https://api.postmarkapp.com/email",
      headers: { "x-postmark-server-token": this.serverToken },
      body: {
        From: email.from,
        To: email.to.join(", "),
        Subject: email.subject,
        TextBody: email.text,
        ...(email.html ? { HtmlBody: email.html } : {}),
        ...(email.replyTo ? { ReplyTo: email.replyTo } : {}),
        MessageStream: this.messageStream,
      },
      errorMessageField: "Message",
    });
    return { messageId: typeof answer.MessageID === "string" ? answer.MessageID : undefined };
  }
}
