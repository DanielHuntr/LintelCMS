import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { isPluginEnabled } from "../plugins/plugins.service.js";
import { EXPERIMENTS_PLUGIN_ID } from "./experiment-pages.js";
import type { ExperimentMeasurement } from "./experiment-measurement.js";
import { findExperimentRow, listVersionRows } from "./experiments.repository.js";
import type { CountRequest } from "./experiments.schema.js";
import { takesPartInTests, type Visitor } from "./visitor-assignment.js";

/**
 * A visit or a conversion reported by a tested page's script. It is counted only while the
 * plugin is on and the test runs, for a version the test has, from a visitor who takes part:
 * a browser asking not to be tracked, or an automated one, is never counted even if it sends
 * a report. Returns whether it was counted.
 */
export async function countFromBrowser(
  database: DatabaseOrTransaction,
  measurement: ExperimentMeasurement,
  report: CountRequest,
  visitor: Visitor,
  now = new Date(),
): Promise<boolean> {
  if (!takesPartInTests(visitor)) return false;
  if (!(await isPluginEnabled(database, EXPERIMENTS_PLUGIN_ID))) return false;
  const row = await findExperimentRow(database, DEFAULT_TENANT_ID, report.experiment);
  if (!row || row.experiment.status !== "running") return false;
  if (report.version !== "original") {
    const versions = await listVersionRows(database, DEFAULT_TENANT_ID, [report.experiment]);
    if (!versions.some((version) => version.key === report.version)) return false;
  }
  const visit = { experimentId: report.experiment, versionKey: report.version, at: now };
  if (report.event === "visit") await measurement.recordVisit(database, visit);
  else await measurement.recordConversion(database, visit);
  return true;
}
