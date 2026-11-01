import { z } from "zod";
import { deliveredEntrySchema } from "../delivery/delivery.schema.js";

/** `POST /entries/:id/preview`: a fresh token, and the website's preview address if it has one. */
export const entryPreviewSchema = z.object({
  token: z.string(),
  expiresAt: z.iso.datetime(),
  /** null when the collection has no preview address: the admin shows its built-in preview. */
  previewUrl: z.string().nullable(),
});

/** `GET /preview?token=` */
export const previewQuerySchema = z.object({
  token: z.string({ error: "Send the preview token as ?token=" }).min(1, {
    error: "Send the preview token as ?token=",
  }),
});

/** `GET /preview`: the draft as the delivery API would serve it once published. */
export const previewedEntrySchema = z.object({
  collection: z.string(),
  /** The handle of the site the draft is on, for websites serving several. */
  site: z.string(),
  entry: deliveredEntrySchema,
});

export type EntryPreview = z.infer<typeof entryPreviewSchema>;
export type PreviewedEntry = z.infer<typeof previewedEntrySchema>;
