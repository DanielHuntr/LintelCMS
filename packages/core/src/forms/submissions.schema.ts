import { z } from "zod";
import type { SubmissionValue } from "./submission-values.js";

export const listSubmissionsQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  filter: z
    .enum(["all", "unread", "starred"], { error: "Filter by all, unread or starred" })
    .default("all"),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

export type ListSubmissionsQuery = z.infer<typeof listSubmissionsQuerySchema>;

export const submissionParamsSchema = z.object({ id: z.uuid(), submissionId: z.uuid() });
export const noteParamsSchema = submissionParamsSchema.extend({ noteId: z.uuid() });

export const updateSubmissionRequestSchema = z.object({
  isRead: z.boolean({ error: "Read should be true or false" }).optional(),
  isStarred: z.boolean({ error: "Starred should be true or false" }).optional(),
});

export const addNoteRequestSchema = z.object({
  body: z
    .string({ error: "Write the note" })
    .trim()
    .min(1, { error: "Write the note" })
    .max(5000, { error: "Notes can be at most 5000 characters" }),
});

/** One person's data, found by the email address they gave. */
export const personRequestSchema = z.object({
  email: z
    .string({ error: "Give the person's email address" })
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "That doesn't look like an email address" })),
});

/** A file answer as the admin sees it, with an address to open it. */
export interface SubmittedFileResponse {
  assetId: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
}

export type SubmissionValueResponse =
  Exclude<SubmissionValue, unknown[]> | string[] | SubmittedFileResponse[];

export interface SubmissionNote {
  id: string;
  body: string;
  author: { id: string; name: string } | null;
  createdAt: string;
}

export interface Submission {
  id: string;
  formId: string;
  values: Record<string, SubmissionValueResponse>;
  submitterEmail: string | null;
  sourceUrl: string | null;
  isRead: boolean;
  isStarred: boolean;
  createdAt: string;
}

export interface SubmissionDetail extends Submission {
  notes: SubmissionNote[];
}

export interface SubmissionList {
  submissions: Submission[];
  total: number;
}
