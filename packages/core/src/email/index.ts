/**
 * What other features use from email. Send through `server.email` (an EmailSender);
 * everything else here is how it is wired. See README.md.
 */
export {
  createConfiguredEmailDriver,
  createConfiguredEmailSender,
  type EmailConfig,
} from "./configured-email.js";
export type { EmailDriver } from "./email-driver.js";
export { EmailNotSentError, InvalidEmailError } from "./email.errors.js";
export type { EmailMessage, OutgoingEmail } from "./email.schema.js";
export { createEmailSender, type EmailSender } from "./email.service.js";
export { OutboxEmailDriver, type OutboxEmail } from "./outbox-email-driver.js";
