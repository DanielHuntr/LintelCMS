import { z } from "zod";

/** Zod schemas and types for the add-on's requests and answers. */

export const PROVIDERS = ["mailchimp", "brevo"] as const;
export const providerSchema = z.enum(PROVIDERS, { error: "Choose Mailchimp or Brevo" });
export type ProviderId = z.output<typeof providerSchema>;

export const PROVIDER_NAMES: Record<ProviderId, string> = {
  mailchimp: "Mailchimp",
  brevo: "Brevo",
};

const apiKeySchema = z
  .string({ error: "The API key should be text" })
  .trim()
  .max(200, { error: "That API key is too long. Copy just the key." });

/**
 * Saving the connection. `apiKey` may be left out to keep the saved key, as long as the
 * service stays the same.
 */
export const connectionInputSchema = z.object({
  provider: providerSchema,
  apiKey: apiKeySchema.optional(),
  listId: z
    .string({ error: "Choose a list" })
    .trim()
    .min(1, { error: "Choose a list" })
    .max(100, { error: "Choose a list" }),
  doubleOptIn: z.boolean({ error: "Double opt-in should be on or off" }).default(true),
  brevoTemplateId: z
    .number({ error: "The template number should be a number" })
    .int({ error: "The template number should be a whole number" })
    .positive({ error: "The template number should be more than 0" })
    .nullable()
    .default(null),
  brevoConfirmUrl: z
    .string({ error: "The page address should be text" })
    .trim()
    .max(500, { error: "Keep the page address under 500 characters" })
    .refine((value) => value === "" || /^https?:\/\//.test(value), {
      error: "The page address should start with https://",
    })
    .default(""),
});
export type ConnectionInput = z.output<typeof connectionInputSchema>;

/** Asking the service for its lists, with the saved key or one just typed. */
export const listsRequestSchema = z.object({
  provider: providerSchema,
  apiKey: apiKeySchema.optional(),
});
export type ListsRequest = z.output<typeof listsRequestSchema>;

export interface NewsletterList {
  id: string;
  name: string;
}

/** The connection as the admin sees it: never the key, only its last four characters. */
export type ConnectionSummary =
  | { connected: false }
  | {
      connected: true;
      provider: ProviderId;
      keyHint: string;
      listId: string;
      listName: string;
      doubleOptIn: boolean;
      brevoTemplateId: number | null;
      brevoConfirmUrl: string;
    };

/** What a visitor sends: their email, perhaps a first name, the consent tick and the trap. */
export interface SignUpRequest {
  email: string;
  firstName: string;
}
