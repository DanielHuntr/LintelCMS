import {
  siteImportItemKinds,
  type SiteImportItemKind,
  type SiteImportReport,
} from "./site-import.schema.js";
import type { SiteImportItemRow } from "./site-import.table.js";

/**
 * The report shown when an import finishes (and, from the dry run, before it starts): how
 * many of each thing came in, what was made, which designed pages to check, which slugs
 * had to change, what was left out and why. Built from the items, so an import that was
 * paused and resumed reports everything it did across both runs.
 */
type ReportedItem = Pick<SiteImportItemRow, "kind" | "status" | "message" | "details" | "payload">;

export function buildSiteReport(
  items: readonly ReportedItem[],
  dryRun: boolean,
  notes: readonly string[],
): SiteImportReport {
  const report: SiteImportReport = {
    dryRun,
    counts: Object.fromEntries(
      siteImportItemKinds.map((kind) => [kind, { done: 0, skipped: 0, failed: 0 }]),
    ) as SiteImportReport["counts"],
    createdTypes: [],
    designedPages: [],
    renamedSlugs: [],
    redirectsSuggested: 0,
    fieldsLeftOut: [],
    notes: [...notes],
    problems: [],
  };
  for (const item of items) {
    const kind = item.kind as SiteImportItemKind;
    if (item.status === "pending" || !report.counts[kind]) continue;
    report.counts[kind][item.status] += 1;
    if (item.status === "failed") {
      report.problems.push({ kind, title: titleOf(item), message: item.message ?? "" });
    }
    addDetails(report, item);
  }
  return report;
}

function addDetails(report: SiteImportReport, item: ReportedItem) {
  const details = item.details ?? {};
  if (typeof details.createdType === "string") {
    report.createdTypes.push(details.createdType);
  }
  if (details.designedPage === true) {
    report.designedPages.push(titleOf(item));
  }
  if (typeof details.renamedFrom === "string" && typeof details.renamedTo === "string") {
    report.renamedSlugs.push({
      title: titleOf(item),
      from: details.renamedFrom,
      to: details.renamedTo,
    });
  }
  if (Array.isArray(details.fieldsLeftOut) && details.fieldsLeftOut.length > 0) {
    report.fieldsLeftOut.push({ title: titleOf(item), fields: details.fieldsLeftOut.map(String) });
  }
  if (details.redirected === true) {
    report.redirectsSuggested += 1;
  }
}

function titleOf(item: ReportedItem): string {
  for (const key of ["title", "name", "filename", "key"]) {
    const value = item.payload[key];
    if (typeof value === "string" && value !== "") return value;
  }
  return item.kind;
}
