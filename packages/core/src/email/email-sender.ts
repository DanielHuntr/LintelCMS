/**
 * The one interface features send email through. Forms use it for notifications; other
 * features can use it the same way. Which sender is used is decided once, in server.ts.
 */
export interface EmailMessage {
  to: readonly string[];
  subject: string;
  /** Plain text. Every mail program can show it, and it can't carry anything active. */
  text: string;
  /** Where "Reply" goes, such as the person who filled in a form. */
  replyTo?: string;
}

export interface EmailSender {
  sendEmail(message: EmailMessage): Promise<void>;
}
