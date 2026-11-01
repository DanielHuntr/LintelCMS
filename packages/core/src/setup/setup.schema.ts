import { z } from "zod";
import { postgresConnectionDetailsSchema } from "../database/database-choice.js";
import { siteNameSchema, siteTypeSchema } from "../settings/settings.schema.js";
import { emailSchema, newPasswordSchema } from "../users/users.schema.js";

/** The owner's account, as the "Your account" step collects it. Same rules as everywhere else. */
export const ownerAccountSchema = z.object({
  email: emailSchema,
  name: z
    .string({ error: "Please enter your name" })
    .trim()
    .min(1, { error: "Please enter your name" })
    .max(200, { error: "Names can be at most 200 characters" }),
  password: newPasswordSchema,
});

/** `POST /setup/database/test` */
export const testDatabaseRequestSchema = postgresConnectionDetailsSchema;

/** The "Database" step's answer: built-in, or a Postgres server (created if missing, when asked). */
export const databaseChoiceRequestSchema = z.discriminatedUnion(
  "kind",
  [
    z.object({ kind: z.literal("built-in") }),
    postgresConnectionDetailsSchema.extend({
      kind: z.literal("postgres"),
      // Create the database on the server if it isn't there yet.
      createIfMissing: z
        .boolean({ error: "createIfMissing should be true or false" })
        .default(false),
    }),
  ],
  { error: 'Please choose "built-in" or "postgres" as the kind of database' },
);

/** The "Site name" and "What you're building" steps. */
export const siteChoicesSchema = z.object({
  siteName: siteNameSchema,
  siteType: siteTypeSchema,
});

/**
 * `POST /setup/finish`: every answer from the setup screens at once. `database` is left out
 * when DATABASE_URL already decided it.
 */
export const finishSetupRequestSchema = z.object({
  database: databaseChoiceRequestSchema.optional(),
  account: ownerAccountSchema,
  site: siteChoicesSchema,
});

/** The setup step an answer belongs to, so the admin can take the person back to it. */
export const setupSteps = ["database", "account", "site"] as const;
export type SetupStep = (typeof setupSteps)[number];

export const databaseStatusSchema = z.object({
  kind: z.enum(["built-in", "postgres"]),
  chosenBy: z.enum(["environment", "setup", "default"]),
});

/** `GET /setup/status` */
export const setupStatusSchema = z.object({
  needsSetup: z.boolean(),
  database: databaseStatusSchema,
  requiresSetupCode: z.boolean(),
  siteSetupCompleted: z.boolean(),
});

export type OwnerAccount = z.infer<typeof ownerAccountSchema>;
export type TestDatabaseRequest = z.infer<typeof testDatabaseRequestSchema>;
export type ChooseDatabaseRequest = z.infer<typeof databaseChoiceRequestSchema>;
export type SiteChoices = z.infer<typeof siteChoicesSchema>;
export type FinishSetupRequest = z.infer<typeof finishSetupRequestSchema>;
export type DatabaseStatus = z.infer<typeof databaseStatusSchema>;
export type SetupStatus = z.infer<typeof setupStatusSchema>;
