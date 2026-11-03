import { definePlugin } from "../plugins/plugin-definition.js";
import { experimentsRoutes } from "./experiments.routes.js";
import {
  defaultExperimentsSettings,
  experimentsSettingsSchema,
} from "./experiments-settings.schema.js";

/**
 * A/B testing: try another version of a page (or one section of it), show each version to a
 * share of visitors, and see which one more often leads to a goal. Its routes answer only
 * while it is switched on (404 PLUGIN_NOT_ENABLED otherwise). While it is off, the website
 * shows every page as published and sends no counting script.
 *
 * Its tables (`experiments`, `experiment_versions`, `experiment_counts`) are in Lintel's own
 * migrations, so the definition has no `database`.
 */
export const experimentsPlugin = definePlugin({
  id: "experiments",
  name: "A/B testing",
  description: "Try another version of a page and see which works better.",
  permissions: [
    {
      permission: "experiments:manage",
      name: "Run A/B tests",
      description: "Try other versions of pages, start and stop tests, and see the results.",
    },
  ],
  settings: { schema: experimentsSettingsSchema, defaults: defaultExperimentsSettings },
  // Counting needs no consent by default; a site that asks first lists it in the cookie
  // notice, and the counting script waits for "plugin:experiments" (see tests-script.ts).
  consentServicesFromSettings: (settings) =>
    settings.countOnlyAfterConsent ? [{ name: "A/B test counts", countsWithoutCookies: true }] : [],
  async routes(server) {
    await server.register(experimentsRoutes);
  },
});
