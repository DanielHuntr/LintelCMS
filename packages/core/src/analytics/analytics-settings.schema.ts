import { z } from "zod";

/**
 * The Visitors plugin's settings (the `plugin:analytics` setting, see src/plugins).
 *
 * - `retentionDays`: how long single visits are kept before only the daily figures remain.
 * - `countOnlyAfterConsent`: for sites that want every visitor to agree first. Counting is
 *   cookieless and anonymous, so it is off by default; when on, the page counts nobody until
 *   the cookie notice (or the site's own code) says yes (see analytics-script.ts).
 */
export const analyticsSettingsSchema = z.object({
  retentionDays: z.number().int().min(7).max(365),
  countOnlyAfterConsent: z.boolean(),
});

export type AnalyticsSettings = z.infer<typeof analyticsSettingsSchema>;

export const defaultAnalyticsSettings: AnalyticsSettings = {
  retentionDays: 30,
  countOnlyAfterConsent: false,
};
