import { z } from "zod";
import { postgresConnectionDetailsSchema } from "../database/database-choice.js";
import { pluginIdListSchema, pluginSummarySchema } from "../plugins/plugins.schema.js";
import { siteTypeSchema } from "../settings/settings.schema.js";
import { emailSchema, newPasswordSchema } from "../users/users.schema.js";

/** `POST /setup`: the first admin's account. Same rules as everywhere else. */
export const completeSetupRequestSchema = z.object({
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

/** `POST /setup/database` */
export const chooseDatabaseRequestSchema = z.discriminatedUnion(
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

/** `POST /setup/site`: the "What are you building?" step. */
export const siteSetupRequestSchema = z.object({
  siteType: siteTypeSchema,
  plugins: pluginIdListSchema,
});

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

export const siteSetupResponseSchema = z.object({
  siteType: siteTypeSchema,
  plugins: z.array(pluginSummarySchema),
});

export type CompleteSetupRequest = z.infer<typeof completeSetupRequestSchema>;
export type TestDatabaseRequest = z.infer<typeof testDatabaseRequestSchema>;
export type ChooseDatabaseRequest = z.infer<typeof chooseDatabaseRequestSchema>;
export type SiteSetupRequest = z.infer<typeof siteSetupRequestSchema>;
export type DatabaseStatus = z.infer<typeof databaseStatusSchema>;
export type SetupStatus = z.infer<typeof setupStatusSchema>;
export type SiteSetupResponse = z.infer<typeof siteSetupResponseSchema>;
