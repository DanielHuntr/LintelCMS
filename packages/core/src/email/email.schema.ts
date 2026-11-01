import { z } from "zod";

/**
 * One email, as features hand it to `server.email.send(...)`. The single source of truth
 * for its shape: drivers receive the parsed result with `from` always filled in.
 */
const address = z.email({ error: "That doesn't look like an email address" });

/** "Ana Lopez <ana@example.com>" or a bare address. */
const sender = z
  .string()
  .trim()
  .refine((value) => address.safeParse(bareAddress(value)).success, {
    error: 'Should be an email address, such as "Lintel <hello@example.com>"',
  });

export const emailMessageSchema = z.object({
  to: z.union([address, z.array(address).min(1, { error: "Who should the email go to?" })]),
  subject: z.string().trim().min(1, { error: "An email needs a subject" }).max(998),
  /** Every email has a plain-text body, for mail apps that don't show HTML. */
  text: z.string().min(1, { error: "An email needs some text" }),
  html: z.string().optional(),
  replyTo: address.optional(),
  /** Leave out to send from EMAIL_FROM. */
  from: sender.optional(),
});

export type EmailMessage = z.input<typeof emailMessageSchema>;

/** What drivers get: every recipient in a list, and the sender settled. */
export interface OutgoingEmail {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html?: string | undefined;
  replyTo?: string | undefined;
}

export const senderSchema = sender;

/** The address inside "Name <address>", or the value itself when there are no brackets. */
export function bareAddress(value: string): string {
  const match = /<([^<>]+)>\s*$/.exec(value);
  return (match?.[1] ?? value).trim();
}
