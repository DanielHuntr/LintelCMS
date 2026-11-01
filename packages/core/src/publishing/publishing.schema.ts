import { z } from "zod";
import { formDeliveryModes, publishTargetKinds } from "./publishing.table.js";

/** Requests and responses for Settings → Publishing. */

const text = (message: string, maximum = 500) =>
  z
    .string({ error: message })
    .trim()
    .max(maximum, { error: `${message} (at most ${maximum} characters)` });

const folderSchema = text("Folders should be text").refine((folder) => !folder.includes("\0"), {
  error: "That folder name can't be used",
});

const siteAddressSchema = z
  .string()
  .trim()
  .refine((address) => address === "" || /^https?:\/\/[^\s/]+/.test(address), {
    error: "The website's address should start with https://, like https://www.example.com",
  })
  .transform((address) => address.replace(/\/+$/, ""));

export const publishTargetOptionsSchema = z.object({
  host: text("The server's address should be text", 255).optional(),
  port: z.number().int().min(1).max(65535, { error: "Ports go up to 65535" }).optional(),
  username: text("The username should be text", 255).optional(),
  remoteFolder: folderSchema.optional(),
  privateFolder: folderSchema.optional(),
  ftpSecurity: z.enum(["explicit", "implicit", "none"]).optional(),
  bucket: text("The bucket name should be text", 255).optional(),
  region: text("The region should be text", 100).optional(),
  endpoint: z
    .string()
    .trim()
    .refine((endpoint) => endpoint === "" || /^https?:\/\//.test(endpoint), {
      error: "The endpoint should start with https://",
    })
    .optional(),
  prefix: folderSchema.optional(),
  folderPath: folderSchema.optional(),
  siteAddress: siteAddressSchema.optional(),
});

/** Write-only: sent when typed, never sent back. An empty string forgets the saved one. */
export const publishTargetSecretsSchema = z.object({
  password: z.string().max(1000).optional(),
  privateKey: z.string().max(20_000).optional(),
  accessKeyId: z.string().trim().max(200).optional(),
  secretAccessKey: z.string().max(500).optional(),
  stripeWebhookSecret: z.string().trim().max(500).optional(),
});

export type PublishTargetSecrets = z.infer<typeof publishTargetSecretsSchema> & {
  /** Signs everything between Lintel and the PHP companion. Made by Lintel, never typed. */
  bridgeSecret?: string;
};

const nameSchema = text("Please give this a name", 100).min(1, {
  error: "Please give this a name, like “My cPanel hosting”",
});

export const createPublishTargetRequestSchema = z.object({
  name: nameSchema,
  kind: z.enum(publishTargetKinds, { error: "Choose where to publish" }),
  options: publishTargetOptionsSchema.default({}),
  secrets: publishTargetSecretsSchema.default({}),
  formDelivery: z.enum(formDeliveryModes).optional(),
  publishAutomatically: z.boolean().default(false),
  deleteLimit: z.number().int().min(0).max(100_000).default(50),
});

export const updatePublishTargetRequestSchema = z.object({
  name: nameSchema.optional(),
  options: publishTargetOptionsSchema.optional(),
  secrets: publishTargetSecretsSchema.optional(),
  formDelivery: z.enum(formDeliveryModes).optional(),
  publishAutomatically: z.boolean().optional(),
  deleteLimit: z.number().int().min(0).max(100_000).optional(),
});

export const publishRequestSchema = z
  .object({
    dryRun: z.boolean().default(false),
    /** Go ahead with more deletions than the target's limit. */
    confirmDeletions: z.boolean().default(false),
  })
  .default({ dryRun: false, confirmDeletions: false });

export const targetIdParamsSchema = z.object({
  id: z.uuid({ error: "That isn't a publishing destination's id" }),
});

export const runParamsSchema = z.object({
  id: z.uuid({ error: "That isn't a publishing destination's id" }),
  runId: z.uuid({ error: "That isn't a publish's id" }),
});

export type CreatePublishTargetRequest = z.infer<typeof createPublishTargetRequestSchema>;
export type UpdatePublishTargetRequest = z.infer<typeof updatePublishTargetRequestSchema>;
export type PublishTargetOptionsInput = z.infer<typeof publishTargetOptionsSchema>;
