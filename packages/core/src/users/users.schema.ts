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

export const userNameSchema = z
  .string({ error: "Please enter a name" })
  .trim()
  .min(1, { error: "Please enter a name" })
  .max(100, { error: "Names can be at most 100 characters" });

export const userIdParamsSchema = z.object({ id: z.uuid() });

export const listUsersQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
});

export const changeUserRoleRequestSchema = z.object({
  roleId: z.uuid({ error: "Please choose a role" }),
});

export const removeUserRequestSchema = z.object({
  /** Who their entries, revisions and uploads move to. */
  reassignToUserId: z.uuid({ error: "Please choose who gets their content" }),
});

/** One person on the Users screen. */
export const userListItemSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string(),
  status: z.enum(["active", "deactivated"]),
  roles: z.array(z.object({ id: z.uuid(), name: z.string(), handle: z.string() })),
  avatarUrl: z.string().nullable(),
  twoFactorEnabled: z.boolean(),
  /** The latest of their last sign-in and the last time a session was used. */
  lastActiveAt: z.string().nullable(),
  createdAt: z.string(),
});

export type UserListItem = z.infer<typeof userListItemSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
