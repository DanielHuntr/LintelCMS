import { z } from "zod";

/** One entry as the built-in dashboard widgets show it. */
export const dashboardEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(["draft", "published", "scheduled"]),
  collection: z.object({ handle: z.string(), name: z.string() }),
  updatedAt: z.string(),
  updatedByName: z.string().nullable(),
  scheduledFor: z.string().nullable(),
  /** Live, with saved changes that aren't published yet. */
  hasUnpublishedChanges: z.boolean(),
});

/** A widget's few entries, and how many there are in all. */
export const dashboardEntryListSchema = z.object({
  entries: z.array(dashboardEntrySchema),
  total: z.number(),
});

export const mediaUsageSchema = z.object({
  fileCount: z.number(),
  totalBytes: z.number(),
  imageCount: z.number(),
  imagesWithoutAltText: z.number(),
});

export type DashboardEntry = z.infer<typeof dashboardEntrySchema>;
export type DashboardEntryList = z.infer<typeof dashboardEntryListSchema>;
export type MediaUsage = z.infer<typeof mediaUsageSchema>;
