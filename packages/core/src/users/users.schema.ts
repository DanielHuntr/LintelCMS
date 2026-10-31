import { z } from "zod";

/**
 * Emails are compared lowercased and trimmed, so "Ana@Example.com " and "ana@example.com"
 * are the same person. Every place that reads an email goes through this schema.
 */
export const emailSchema = z
  .string({ error: "Please enter an email address" })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "That doesn't look like an email address" }));

/** Rules for choosing a new password. Signing in only checks the password is present. */
export const newPasswordSchema = z
  .string()
  .min(12, { error: "Passwords need at least 12 characters" })
  .max(1000, { error: "Passwords can be at most 1000 characters" });

/** What the API shows about a user. Never includes the password hash. */
export const publicUserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string(),
});

export type PublicUser = z.infer<typeof publicUserSchema>;
