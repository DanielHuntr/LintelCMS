import { z } from "zod";
import { optionalSetting, settingWithDefault, wholeNumberSetting } from "../config-values.js";
import { senderSchema } from "./email.schema.js";

/** A placeholder on a reserved domain: fine for the outbox, refused by every real driver. */
export const DEFAULT_EMAIL_FROM = "Lintel <lintel@example.invalid>";

export const EMAIL_DRIVERS = ["outbox", "smtp", "resend", "postmark"] as const;

/**
 * How Lintel sends email. Part of the one config schema in src/config.ts. Until
 * EMAIL_DRIVER is set, emails go to the outbox (`.lintel/outbox`) and nobody is emailed.
 */
export const emailSettings = {
  EMAIL_DRIVER: settingWithDefault(
    z.enum(EMAIL_DRIVERS, { error: `Should be one of ${EMAIL_DRIVERS.join(", ")}` }),
    "outbox",
  ),
  EMAIL_FROM: settingWithDefault(senderSchema, DEFAULT_EMAIL_FROM),
  SMTP_HOST: optionalSetting(z.string().trim().min(1)),
  SMTP_PORT: wholeNumberSetting(587),
  // Leave out to decide from the port: on for 465, off (STARTTLS) for anything else.
  SMTP_SECURE: optionalSetting(
    z
      .enum(["true", "false"], { error: "Should be true or false" })
      .transform((value) => value === "true"),
  ),
  SMTP_USER: optionalSetting(z.string().trim().min(1)),
  SMTP_PASSWORD: optionalSetting(z.string()),
  RESEND_API_KEY: optionalSetting(z.string().trim().min(1)),
  POSTMARK_SERVER_TOKEN: optionalSetting(z.string().trim().min(1)),
  POSTMARK_MESSAGE_STREAM: settingWithDefault(z.string().trim().min(1), "outbound"),
};

interface EmailSettingsToCheck {
  NODE_ENV: string;
  EMAIL_DRIVER: (typeof EMAIL_DRIVERS)[number];
  EMAIL_FROM: string;
  SMTP_HOST?: string | undefined;
  RESEND_API_KEY?: string | undefined;
  POSTMARK_SERVER_TOKEN?: string | undefined;
}

const NEEDED_SETTING = {
  smtp: ["SMTP_HOST", "the mail server's address, such as smtp.example.com"],
  resend: ["RESEND_API_KEY", "the API key from resend.com/api-keys"],
  postmark: ["POSTMARK_SERVER_TOKEN", "the Server API token from your Postmark server's settings"],
} as const;

/** Rules that need more than one setting. Called from config.ts. */
export function checkEmailSettings(settings: EmailSettingsToCheck, context: z.RefinementCtx) {
  if (settings.EMAIL_DRIVER === "outbox") return;

  const [name, what] = NEEDED_SETTING[settings.EMAIL_DRIVER];
  if (!settings[name]) {
    context.addIssue({
      code: "custom",
      path: [name],
      message: `EMAIL_DRIVER is ${settings.EMAIL_DRIVER}, so Lintel needs ${what}`,
    });
  }
  if (settings.EMAIL_FROM === DEFAULT_EMAIL_FROM) {
    context.addIssue({
      code: "custom",
      path: ["EMAIL_FROM"],
      message:
        'Set the address emails come from, such as "Your Site <hello@example.com>", on a domain your sending service has verified',
    });
  }
}
