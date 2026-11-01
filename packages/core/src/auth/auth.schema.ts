import { z } from "zod";
import { emailSchema, publicUserSchema } from "../users/users.schema.js";

/**
 * Sign-in only checks a password is present. The length rules for choosing one live in
 * users.schema.ts; applying them here would tell people with older, shorter passwords
 * something useless.
 */
export const signInRequestSchema = z.object({
  email: emailSchema,
  password: z
    .string({ error: "Please enter your password" })
    .min(1, { error: "Please enter your password" })
    // Hashing is deliberately slow; refusing huge inputs keeps it from being abused.
    .max(1000, { error: "Passwords can be at most 1000 characters" }),
});

/** What `POST /auth/sign-in`, `POST /setup/finish` and `GET /auth/me` return. */
export const signedInSchema = z.object({
  user: publicUserSchema,
  permissions: z.array(z.string()),
  /** Which plugins are on, so the admin can show their sections without another request. */
  enabledPlugins: z.array(z.string()),
  /** The website's address for "View page", or "" when none is connected (Settings → Site). */
  siteAddress: z.string(),
  /** The site's name for the browser tab and the sidebar. Null until setup names it. */
  siteName: z.string().nullable(),
});

export type SignInRequest = z.infer<typeof signInRequestSchema>;
export type SignedIn = z.infer<typeof signedInSchema>;
