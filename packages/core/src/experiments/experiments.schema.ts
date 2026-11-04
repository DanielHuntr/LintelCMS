import { z } from "zod";

/**
 * The shapes of A/B tests ("experiments" in code). One schema per thing; types are inferred.
 *
 * Versions are keyed "original", "b" and "c". The original is the page as published; B and C
 * are designs kept with the test until one of them is made the page.
 */

export const versionKeys = ["original", "b", "c"] as const;
export type VersionKey = (typeof versionKeys)[number];
export const challengerKeys = ["b", "c"] as const;
export type ChallengerKey = (typeof challengerKeys)[number];
export const versionKeySchema = z.enum(versionKeys);
export const challengerKeySchema = z.enum(challengerKeys);

/** At most the original and two others, so each gets enough visitors to tell them apart. */
export const MAXIMUM_VERSIONS = 3;

export const experimentStatuses = ["draft", "running", "stopped", "ended"] as const;
export type ExperimentStatus = (typeof experimentStatuses)[number];

/** Whether a version is a whole page or one section of it. */
export const experimentScopes = ["page", "section"] as const;
export type ExperimentScope = (typeof experimentScopes)[number];

/**
 * What counts as success:
 * - `form`: someone sends any form on the site after seeing the page.
 * - `order`: someone places an order (reaches the order confirmation page).
 * - `click`: someone clicks a link or button that goes to `target`.
 * - `page`: someone reaches the page `entryId`.
 * - `analytics`: something the Visitors plugin counts, by its name there: a particular form
 *   sent ("form:contact"), an order ("order") or an event the site names itself
 *   (`lintelAnalytics.track("signup")` is "signup"). Offered while Visitors is on.
 */
export const goalSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("form") }),
  z.object({ kind: z.literal("order") }),
  z.object({
    kind: z.literal("click"),
    target: z.string().trim().min(1, "Choose the button or link that counts.").max(2000),
    label: z.string().trim().max(200).optional(),
  }),
  z.object({ kind: z.literal("page"), entryId: z.uuid("Choose the page that counts.") }),
  z.object({
    kind: z.literal("analytics"),
    name: z
      .string()
      .trim()
      .min(1, "Choose what counts.")
      .max(60)
      .regex(/^[\p{L}\p{N} _.:-]+$/u, "Use letters, numbers, spaces, dots, colons and dashes."),
  }),
]);
export type ExperimentGoal = z.infer<typeof goalSchema>;

/**
 * The share of visitors each version gets, in whole percent, original first. It always adds
 * up to 100 and has one share per version.
 */
export const splitSchema = z
  .array(z.number().int().min(1, "Every version needs some visitors.").max(99))
  .min(2)
  .max(MAXIMUM_VERSIONS)
  .refine((shares) => shares.reduce((sum, share) => sum + share, 0) === 100, {
    message: "The shares should add up to 100%.",
  });

export const createExperimentRequestSchema = z.object({
  entryId: z.uuid(),
  /** The section to try another version of; the whole page when left out. */
  sectionId: z.string().min(1).max(100).optional(),
});

export const addVersionRequestSchema = z.object({
  /** Which version the new one starts as a copy of. */
  from: versionKeySchema.default("original"),
});

export const updateExperimentRequestSchema = z.object({
  goal: goalSchema.nullable().optional(),
  split: splitSchema.optional(),
});

/** A page design, checked properly by the page's own rules when it is saved. */
export const saveVersionRequestSchema = z.object({
  design: z.record(z.string(), z.unknown()),
  /** When the version was saved, as the admin last read it; a newer one is not saved over. */
  baseUpdatedAt: z.iso.datetime().nullable().optional(),
});

export const chooseWinnerRequestSchema = z.object({ version: versionKeySchema });

export const experimentIdParamsSchema = z.object({ id: z.uuid() });
export const versionParamsSchema = z.object({ id: z.uuid(), version: challengerKeySchema });
export const entryIdParamsSchema = z.object({ entryId: z.uuid() });

/** What a visitor's browser reports: one visit or one conversion, for one version. */
export const countRequestSchema = z.object({
  experiment: z.uuid(),
  version: versionKeySchema,
  event: z.enum(["visit", "conversion"]),
});
export type CountRequest = z.infer<typeof countRequestSchema>;

export interface ExperimentVersionSummary {
  key: VersionKey;
  /** The challenger's design: the page, or for a section test the page with that section. */
  design: Record<string, unknown> | null;
  updatedAt: string | null;
}

export interface ExperimentResponse {
  id: string;
  entryId: string;
  pageTitle: string;
  collection: string;
  scope: ExperimentScope;
  sectionId: string | null;
  status: ExperimentStatus;
  goal: ExperimentGoal | null;
  split: number[];
  winner: VersionKey | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  versions: ExperimentVersionSummary[];
}
