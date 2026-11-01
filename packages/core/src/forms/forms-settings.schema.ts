import { z } from "zod";

const turnstileKeySchema = z
  .string({ error: "Turnstile keys should be text" })
  .trim()
  .max(200, { error: "Turnstile keys are at most 200 characters" })
  .transform((key) => (key === "" ? null : key))
  .nullable();

/**
 * Cloudflare Turnstile, the optional "are you human?" check. Both keys come from the
 * Cloudflare dashboard; it is used only when both are set. Honeypot, timing and rate
 * limits are always on and need no settings.
 */
export const formsSpamSettingsSchema = z.object({
  turnstileSiteKey: turnstileKeySchema,
  turnstileSecretKey: turnstileKeySchema,
});

export type FormsSpamSettings = z.infer<typeof formsSpamSettingsSchema>;

/**
 * `PUT /forms-settings`. Leaving the secret out keeps the saved one, because the admin
 * never sees it again once saved; send null (or "") to remove it.
 */
export const updateFormsSettingsRequestSchema = z.object({
  turnstileSiteKey: turnstileKeySchema,
  turnstileSecretKey: turnstileKeySchema.optional(),
});

/** What the admin sees: the site key, and only whether a secret is saved. */
export interface FormsSettingsResponse {
  turnstileSiteKey: string | null;
  hasTurnstileSecret: boolean;
}
