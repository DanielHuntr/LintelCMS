import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import type { VersionCounts } from "./experiment-statistics.js";
import type { VersionKey } from "./experiments.schema.js";
import { addToCounts, sumCountsByVersion } from "./experiments.repository.js";

/**
 * Where a test's visitors and conversions are counted and read back. The built-in one keeps
 * plain daily counts in `experiment_counts`, fed by the tested pages' own small script. It is
 * a seam on purpose: a site that also has first-party analytics can count with that instead,
 * so a test's goal can be any goal analytics knows. See docs/decisions/0044-ab-testing.md.
 */
export interface ExperimentMeasurement {
  /** A browser saw this version of the tested page for the first time. */
  recordVisit(database: DatabaseOrTransaction, visit: CountedVisit): Promise<void>;
  /** A browser that saw this version reached the test's goal, for the first time. */
  recordConversion(database: DatabaseOrTransaction, visit: CountedVisit): Promise<void>;
  /** Visitors and conversions so far, for every version that has any. */
  readCounts(
    database: DatabaseOrTransaction,
    experimentId: string,
  ): Promise<Map<VersionKey, VersionCounts>>;
}

export interface CountedVisit {
  experimentId: string;
  versionKey: VersionKey;
  at: Date;
}

/** The day a count belongs to, in UTC: "2026-11-03". */
function dayOf(at: Date): string {
  return at.toISOString().slice(0, 10);
}

export const builtInMeasurement: ExperimentMeasurement = {
  recordVisit: (database, visit) =>
    addToCounts(database, {
      tenantId: DEFAULT_TENANT_ID,
      experimentId: visit.experimentId,
      versionKey: visit.versionKey,
      day: dayOf(visit.at),
      visitors: 1,
      conversions: 0,
    }),
  recordConversion: (database, visit) =>
    addToCounts(database, {
      tenantId: DEFAULT_TENANT_ID,
      experimentId: visit.experimentId,
      versionKey: visit.versionKey,
      day: dayOf(visit.at),
      visitors: 0,
      conversions: 1,
    }),
  async readCounts(database, experimentId) {
    const rows = await sumCountsByVersion(database, DEFAULT_TENANT_ID, experimentId);
    return new Map(
      rows.map((row) => [row.versionKey, { visitors: row.visitors, conversions: row.conversions }]),
    );
  },
};
