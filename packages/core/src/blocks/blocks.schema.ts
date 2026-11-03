import { z } from "zod";
import { fieldSchema } from "../blueprints/blueprints.schema.js";
import { handleSchema } from "../http/handle.schema.js";

/** Properties are sent as a plain list and checked one by one, like a blueprint's fields. */
const propertyListSchema = z.array(z.unknown(), { error: "Please send the properties as a list" });

const blockNameSchema = z
  .string({ error: "Please give the block a name" })
  .trim()
  .min(1, { error: "Please give the block a name" })
  .max(100, { error: "Names can be at most 100 characters" });

const blockDetailsShape = {
  name: blockNameSchema,
  icon: z
    .string()
    .regex(/^[a-z0-9-]{1,40}$/, { error: "An icon should be a name like “users”" })
    .default("square"),
  category: z.string().trim().max(60, { error: "Groups can be at most 60 characters" }).default(""),
  description: z
    .string()
    .trim()
    .max(200, { error: "Descriptions can be at most 200 characters" })
    .default(""),
  properties: propertyListSchema.default([]),
  // Checked in full as a page design by the service.
  design: z.record(z.string(), z.unknown(), { error: "The design should be one element" }),
};

/** `POST /blocks`. The handle is made from the name when it is left out. */
export const createBlockRequestSchema = z.object({
  handle: handleSchema("Please give the block a handle").optional(),
  ...blockDetailsShape,
});

/** `PUT /blocks/:handle`. The handle can't change: pages refer to it. */
export const updateBlockRequestSchema = z.object({
  ...blockDetailsShape,
  /** Properties whose handle changed, old to new, so pages keep what was filled in. */
  renamedProperties: z
    .record(
      handleSchema("Each renamed property needs its old handle"),
      handleSchema("Each renamed property needs its new handle"),
    )
    .default({}),
  /** Go ahead even though pages have filled in properties this removes. */
  confirmRemovals: z.boolean().default(false),
});

export const blockParamsSchema = z.object({ handle: z.string() });

export const deleteBlockQuerySchema = z.object({
  /** Turn every instance into plain elements first, so the pages look the same. */
  convert: z.enum(["true", "false"]).default("false"),
});

/** `POST /blocks/render`: React blocks from code, drawn by the server for the canvas. */
export const renderBlocksRequestSchema = z.object({
  instances: z
    .array(
      z.object({
        id: z.string().max(100),
        block: z.string().max(64),
        values: z.record(z.string(), z.unknown()).default({}),
      }),
    )
    .max(200, { error: "At most 200 blocks can be drawn at once" }),
});

const pageUseSchema = z.object({ entryId: z.uuid(), title: z.string(), collection: z.string() });

export const blockSchema = z.object({
  id: z.string(),
  handle: z.string(),
  name: z.string(),
  icon: z.string(),
  category: z.string(),
  description: z.string(),
  source: z.enum(["site", "code", "plugin"]),
  properties: z.array(fieldSchema),
  design: z.record(z.string(), z.unknown()).nullable(),
  template: z.string().nullable(),
  renamedProperties: z.record(z.string(), z.string()),
  version: z.number().int(),
  /** Made in the builder, so its design and properties can be changed in the admin. */
  editable: z.boolean(),
  /** The pages it is on, including in blocks fields. */
  usedOn: z.array(pageUseSchema),
  /** The content types whose blocks fields offer it, by name. */
  usedIn: z.array(z.string()),
  updatedAt: z.string(),
});

export type CreateBlockRequest = z.infer<typeof createBlockRequestSchema>;
export type UpdateBlockRequest = z.infer<typeof updateBlockRequestSchema>;
export type RenderBlocksRequest = z.infer<typeof renderBlocksRequestSchema>;
export type BlockResponse = z.infer<typeof blockSchema>;
