import { join } from "node:path";
import type { EmailDriver } from "./email-driver.js";
import type { EMAIL_DRIVERS } from "./email.config.js";
import { createEmailSender, type EmailSender } from "./email.service.js";
import { OutboxEmailDriver } from "./outbox-email-driver.js";
import { PostmarkEmailDriver } from "./postmark-email-driver.js";
import { ResendEmailDriver } from "./resend-email-driver.js";
import { SmtpEmailDriver } from "./smtp-email-driver.js";

/** The email settings from src/config.ts (see email.config.ts). */
export interface EmailConfig {
  EMAIL_DRIVER: (typeof EMAIL_DRIVERS)[number];
  SMTP_HOST?: string | undefined;
  SMTP_PORT: number;
  SMTP_SECURE?: boolean | undefined;
  SMTP_USER?: string | undefined;
  SMTP_PASSWORD?: string | undefined;
  RESEND_API_KEY?: string | undefined;
  POSTMARK_SERVER_TOKEN?: string | undefined;
  POSTMARK_MESSAGE_STREAM: string;
}

/** The driver the settings ask for. The outbox keeps emails in `<lintel folder>/outbox`. */
export function createConfiguredEmailDriver(
  config: EmailConfig,
  lintelFolder: string,
): EmailDriver {
  switch (config.EMAIL_DRIVER) {
    case "smtp":
      return new SmtpEmailDriver({
        host: config.SMTP_HOST ?? "localhost",
        port: config.SMTP_PORT,
        secure: config.SMTP_SECURE ?? config.SMTP_PORT === 465,
        user: config.SMTP_USER,
        password: config.SMTP_PASSWORD,
      });
    case "resend":
      return new ResendEmailDriver(config.RESEND_API_KEY ?? "");
    case "postmark":
      return new PostmarkEmailDriver(
        config.POSTMARK_SERVER_TOKEN ?? "",
        config.POSTMARK_MESSAGE_STREAM,
      );
    case "outbox":
      return new OutboxEmailDriver(join(lintelFolder, "outbox"));
  }
}

/** The sender `server.email` uses, from the settings. */
export function createConfiguredEmailSender(
  config: EmailConfig & { EMAIL_FROM: string },
  lintelFolder: string,
): EmailSender {
  return createEmailSender(createConfiguredEmailDriver(config, lintelFolder), {
    defaultFrom: config.EMAIL_FROM,
    keepsInOutbox: config.EMAIL_DRIVER === "outbox",
  });
}
