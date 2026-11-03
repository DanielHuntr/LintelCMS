import { z } from "zod";
import { clientReviewStatuses, type ClientReviewStatus } from "./client-reviews.table.js";

export const clientChangesRules = ["goLive", "needsApproval"] as const;

/** `GET` and `PATCH /client-editing/settings`. */
export const clientEditingSettingsSchema = z.object({
  clientChanges: z.enum(clientChangesRules, {
    error: `clientChanges should be one of: ${clientChangesRules.join(", ")}`,
  }),
});
export type ClientEditingSettings = z.infer<typeof clientEditingSettingsSchema>;

export const sendForReviewRequestSchema = z.object({
  note: z.string().trim().max(1000, { error: "Keep the note under 1,000 characters" }).default(""),
});

export const sendBackRequestSchema = z.object({
  note: z
    .string({ error: "Say what to change, so they know what to do" })
    .trim()
    .min(1, { error: "Say what to change, so they know what to do" })
    .max(1000, { error: "Keep the note under 1,000 characters" }),
});

export const reviewIdParamsSchema = z.object({ id: z.uuid({ error: "That isn't a review id" }) });

export const listReviewsQuerySchema = z.object({
  status: z.enum(clientReviewStatuses).default("waiting"),
});

export interface ClientReviewResponse {
  id: string;
  entryId: string;
  status: ClientReviewStatus;
  requestedByName: string | null;
  requestNote: string;
  requestedAt: string;
  decidedByName: string | null;
  decisionNote: string;
  decidedAt: string | null;
}

/** A review in the "Waiting for review" list, with the entry it is about. */
export interface ClientReviewListItem extends ClientReviewResponse {
  entry: { id: string; title: string; collection: string; collectionName: string };
}

/** Where an entry's review stands, for the editor and the builder. */
export interface EntryReviewState {
  /** Whether clients' changes wait for approval on this site. */
  needsApproval: boolean;
  /** Whether the person asking must send their changes for review rather than publish. */
  mustSendForReview: boolean;
  /** The entry's latest review, if any. */
  review: ClientReviewResponse | null;
}

/** `EntryReviewState` as a schema, for the API's documentation. */
export const entryReviewStateSchema = z.object({
  needsApproval: z.boolean(),
  mustSendForReview: z.boolean(),
  review: z
    .object({
      id: z.uuid(),
      entryId: z.uuid(),
      status: z.enum(clientReviewStatuses),
      requestedByName: z.string().nullable(),
      requestNote: z.string(),
      requestedAt: z.string(),
      decidedByName: z.string().nullable(),
      decisionNote: z.string(),
      decidedAt: z.string().nullable(),
    })
    .nullable(),
});
