/**
 * The event model every visitor figure is built from, kept small on purpose so later
 * features (experiments, funnels) add to it rather than change it:
 *
 *   - "view"     someone opened a page
 *   - "leave"    they left it, with how long it was open and in view
 *   - "outbound" they followed a link to another website (`name` is its domain)
 *   - "goal"     something the site wants to happen: a form sent ("form:<handle>"), an order
 *                paid ("order", with its `value`), or a named event marked as a goal
 *   - "custom"   anything else the site names itself: `lintelAnalytics.track("signup")`
 *
 * An experiment adds which version a visitor saw to `properties` ({ experiment, variant })
 * and reads its goals from the same rows, so nothing here needs to change for it.
 */
export const analyticsEventKinds = ["view", "leave", "outbound", "goal", "custom"] as const;
export type AnalyticsEventKind = (typeof analyticsEventKinds)[number];

export const deviceClasses = ["phone", "tablet", "desktop"] as const;
export type DeviceClass = (typeof deviceClasses)[number];

/** Short, plain values only, so nothing personal can be tucked in. */
export type EventProperties = Record<string, string | number | boolean>;

/** The goal names the server records itself. */
export const ORDER_GOAL = "order";
export const formGoalName = (formHandle: string) => `form:${formHandle}`;

/**
 * What the rollups count, one row per day, site, dimension and key. "version" is an A/B
 * test's version that page views were tagged with, keyed "<test id>:<version>".
 */
export const rollupDimensions = [
  "total",
  "page",
  "source",
  "campaign",
  "device",
  "country",
  "goal",
  "outbound",
  "event",
  "version",
] as const;
export type RollupDimension = (typeof rollupDimensions)[number];
