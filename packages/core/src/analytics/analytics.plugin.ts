import { definePlugin } from "../plugins/plugin-definition.js";
import { analyticsRoutes } from "./analytics.routes.js";
import { analyticsSettingsSchema, defaultAnalyticsSettings } from "./analytics-settings.schema.js";
import { collectRoutes } from "./collect.routes.js";

/**
 * "Visitors": counting the website's visitors without cookies or anything personal, and
 * the Visitors screen in the admin. On for new sites (see src/setup/site-presets.ts) and
 * docs/decisions/0042-built-in-visitor-counts.md for why. Its routes answer only while it
 * is on; the goals it records and its timed jobs are set up by `registerAnalytics`.
 *
 * Its tables (`analytics_events`, `analytics_daily`, `analytics_salts`) are in Lintel's own
 * migrations, so the definition has no `database`.
 */
export const analyticsPlugin = definePlugin({
  id: "analytics",
  name: "Visitors",
  description: "Count visitors without cookies, and see which pages they read.",
  permissions: [
    {
      permission: "analytics:read",
      name: "See visitors",
      description: "Visitor counts, top pages and goals, and exporting them.",
    },
  ],
  settings: { schema: analyticsSettingsSchema, defaults: defaultAnalyticsSettings },
  // Counting is cookieless, so the cookie notice names it only when the site asks visitors
  // first; the beacon then waits for "plugin:analytics" (see analytics-script.ts).
  consentServicesFromSettings: (settings) =>
    settings.countOnlyAfterConsent ? [{ name: "Visitor counts" }] : [],
  async routes(server) {
    await server.register(collectRoutes);
    await server.register(analyticsRoutes);
  },
});
