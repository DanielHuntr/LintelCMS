/**
 * How the shop sends email. Lintel ships one provider, the outbox (outbox-email-provider.ts),
 * which keeps every email for reading in the admin instead of sending it. To send real
 * email, pass another provider as `commerce.emailProvider` to `buildServer`: anything with
 * a `send` method, such as a wrapper round an SMTP library or a mail service's API.
 */
export const orderEmailKinds = ["order_confirmation", "order_shipped", "order_refunded"] as const;
export type OrderEmailKind = (typeof orderEmailKinds)[number];

export interface EmailMessage {
  kind: OrderEmailKind;
  to: string;
  subject: string;
  text: string;
  html: string;
  /** The order it is about, so the outbox can link to it. */
  orderId?: string;
}

export interface EmailProvider {
  /** Shown in the admin: "Outbox (not sent)", "Postmark"... */
  readonly name: string;
  /** True when emails really leave the server; the admin warns when they don't. */
  readonly deliversEmail: boolean;
  send(message: EmailMessage): Promise<void>;
}
