/**
 * Lintel's performance budgets, in one place so they are easy to find and argue about.
 * A test fails when a measurement goes over its budget. Raise a budget only on purpose,
 * in its own commit, saying why.
 *
 * The timings are for a local machine with nothing else to do, and leave room for a
 * busy CI runner; they catch something becoming several times slower, not 5%.
 */
const timingScale = Number(process.env.LINTEL_E2E_TIMING_SCALE ?? "1") || 1;

/**
 * Timings depend on the machine, so they are only enforced where the machine is known: in
 * CI, or anywhere with LINTEL_E2E_TIMING_BUDGETS=enforce. Elsewhere (a busy laptop) they are
 * measured and reported, not failed. LINTEL_E2E_TIMING_BUDGETS=record turns them off in CI,
 * and LINTEL_E2E_TIMING_SCALE=2 doubles every timing budget for a slower runner.
 * Sizes don't depend on the machine and are always enforced.
 */
export const enforceTimingBudgets = process.env.LINTEL_E2E_TIMING_BUDGETS
  ? process.env.LINTEL_E2E_TIMING_BUDGETS === "enforce"
  : Boolean(process.env.CI);

export const budgets = {
  /**
   * JavaScript the admin loads before it can show anything, gzipped. About 401 kB when this
   * was set: almost everything is in one chunk, so splitting screens out by route is the way
   * to bring it (and this budget) down.
   */
  adminInitialJavaScriptKilobytes: 425,
  /** CSS the admin loads up front, gzipped. */
  adminInitialCssKilobytes: 30,
  /** Largest Contentful Paint, loading cold from the local server. */
  dashboardLargestContentfulPaintMilliseconds: 2500 * timingScale,
  entryEditorLargestContentfulPaintMilliseconds: 2500 * timingScale,
  /** The 95th percentile of list endpoints with 1,000 entries in a collection. */
  listEndpointP95Milliseconds: 250 * timingScale,
} as const;
