import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { publishEntry } from "../entries/entry-publishing.service.js";
import { type EntryChangeContext, saveEntry } from "../entries/entries.service.js";
import { readDesign, versionAsPage } from "./experiment-designs.js";
import type { ExperimentMeasurement } from "./experiment-measurement.js";
import {
  type Comparison,
  compareWithOriginal,
  conversionRate,
  hasEnoughData,
  MINIMUM_CONVERSIONS,
  MINIMUM_VISITORS_PER_VERSION,
} from "./experiment-statistics.js";
import {
  ExperimentEndedError,
  SectionNotFoundError,
  VersionNotFoundError,
} from "./experiments.errors.js";
import { listVersionRows, updateExperimentRow } from "./experiments.repository.js";
import type { ExperimentResponse, VersionKey } from "./experiments.schema.js";
import {
  DESIGN_FIELD,
  findExperiment,
  findExperimentRowOrFail,
  readPageDesign,
} from "./experiments.service.js";

/** A test's results so far, and ending it: keeping the original or making a version the page. */

const tenantId = DEFAULT_TENANT_ID;

export interface VersionResult {
  key: VersionKey;
  /** Its share of visitors, in whole percent. */
  share: number;
  visitors: number;
  conversions: number;
  /** Conversions per visitor, 0 to 1. */
  rate: number;
  /** Against the original; the original itself has none. */
  comparison: Comparison | null;
}

export interface ExperimentResults {
  enoughData: boolean;
  minimumVisitors: number;
  minimumConversions: number;
  versions: VersionResult[];
}

export async function readResults(
  database: DatabaseOrTransaction,
  measurement: ExperimentMeasurement,
  experimentId: string,
): Promise<ExperimentResults> {
  const row = await findExperimentRowOrFail(database, experimentId);
  const versions = await listVersionRows(database, tenantId, [experimentId]);
  const counts = await measurement.readCounts(database, experimentId);
  const keys: VersionKey[] = ["original", ...versions.map((version) => version.key)];
  const countsFor = (key: VersionKey) => counts.get(key) ?? { visitors: 0, conversions: 0 };
  const enoughData = hasEnoughData(keys.map(countsFor));
  const original = countsFor("original");
  return {
    enoughData,
    minimumVisitors: MINIMUM_VISITORS_PER_VERSION,
    minimumConversions: MINIMUM_CONVERSIONS,
    versions: keys.map((key, index) => {
      const own = countsFor(key);
      return {
        key,
        share: row.experiment.split[index] ?? 0,
        visitors: own.visitors,
        conversions: own.conversions,
        rate: conversionRate(own),
        comparison: key === "original" ? null : compareWithOriginal(original, own, enoughData),
      };
    }),
  };
}

/**
 * Ends the test. Keeping the original changes nothing on the site. Choosing B or C saves it as
 * the page's design and publishes the page, by the usual rules for saving and publishing (the
 * route checks the person may publish). Returns whether the page was published.
 */
export async function endExperiment(
  database: DatabaseOrTransaction,
  experimentId: string,
  winner: VersionKey,
  context: EntryChangeContext,
  now = new Date(),
): Promise<{ experiment: ExperimentResponse; published: boolean }> {
  const row = await findExperimentRowOrFail(database, experimentId);
  if (row.experiment.status === "ended") throw new ExperimentEndedError();
  if (winner !== "original") {
    const versions = await listVersionRows(database, tenantId, [experimentId]);
    const version = versions.find((candidate) => candidate.key === winner);
    if (!version) throw new VersionNotFoundError(winner);
    const page = await readPageDesign(database, row.experiment.entryId);
    const versionDesign = readDesign(version.design);
    const design = versionDesign && versionAsPage(row.experiment, page, versionDesign);
    if (!design) throw new SectionNotFoundError();
    await saveEntry(
      database,
      row.experiment.entryId,
      { data: { [DESIGN_FIELD]: design } },
      context,
    );
    await publishEntry(database, row.experiment.entryId, context, now);
  }
  await updateExperimentRow(database, tenantId, experimentId, {
    status: "ended",
    winner,
    endedAt: now,
  });
  return {
    experiment: await findExperiment(database, experimentId),
    published: winner !== "original",
  };
}
