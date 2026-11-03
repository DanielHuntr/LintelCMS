import { draftSectionKinds, MOST_DRAFT_SECTIONS } from "@lintel/builder-model";
import { z } from "zod";

export const draftTones = ["friendly", "professional", "playful", "calm"] as const;
export const rewriteStyles = ["shorter", "friendlier", "more-formal"] as const;

/** "Draft a page for me": what the page is for, who it's for, the tone and the sections. */
export const draftPageRequestSchema = z.object({
  purpose: z.string().trim().min(3).max(600),
  audience: z.string().trim().max(200).default(""),
  tone: z.enum(draftTones).default("friendly"),
  /** Empty: the model chooses. Otherwise exactly these, in this order. */
  sections: z
    .array(z.enum(draftSectionKinds as [string, ...string[]]))
    .max(MOST_DRAFT_SECTIONS)
    .default([]),
});
export type DraftPageRequest = z.infer<typeof draftPageRequestSchema>;

/** "Rewrite this", for one heading or paragraph. */
export const rewriteRequestSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  style: z.enum(rewriteStyles),
});
export type RewriteRequest = z.infer<typeof rewriteRequestSchema>;

export const draftJobParamsSchema = z.object({ jobId: z.uuid() });
