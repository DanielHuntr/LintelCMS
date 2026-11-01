import {
  type WordPressImportReport,
  wordpressItemKinds,
  type WordPressItemKind,
} from "./wordpress-import.schema.js";
import type { WordPressImportItemRow } from "./wordpress-import.table.js";

/**
 * The report shown when an import finishes (and, from the dry run, before it starts):
 * how many of each thing came in, who was invited, which posts have blocks kept as HTML,
 * which slugs had to change and what went wrong. Built from the items, so an import that
 * was paused and resumed reports everything it did across both runs.
 */
type ReportedItem = Pick<
  WordPressImportItemRow,
  "kind" | "status" | "message" | "details" | "payload"
>;

export function buildReport(
  items: readonly ReportedItem[],
  dryRun: boolean,
): WordPressImportReport {
  const report: WordPressImportReport = {
    dryRun,
    counts: Object.fromEntries(
      wordpressItemKinds.map((kind) => [kind, { done: 0, skipped: 0, failed: 0 }]),
    ) as WordPressImportReport["counts"],
    invitedPeople: [],
    keptAsHtml: {},
    entriesWithHtml: [],
    renamedSlugs: [],
    redirectsSuggested: 0,
    problems: [],
  };

  for (const item of items) {
    const kind = item.kind as WordPressItemKind;
    if (item.status === "pending" || !report.counts[kind]) {
      continue;
    }
    report.counts[kind][item.status] += 1;
    if (item.status === "failed") {
      report.problems.push({ kind, title: titleOf(item), message: item.message ?? "" });
    }
    addDetails(report, item);
  }
  return report;
}

function addDetails(report: WordPressImportReport, item: ReportedItem) {
  const details = item.details ?? {};
  if (details.invited === true) {
    report.invitedPeople.push({
      name: String(details.name ?? ""),
      email: String(details.email ?? ""),
    });
  }
  const kept = Array.isArray(details.keptAsHtml) ? details.keptAsHtml.map(String) : [];
  for (const reason of kept) {
    report.keptAsHtml[reason] = (report.keptAsHtml[reason] ?? 0) + 1;
  }
  if (kept.length > 0) {
    report.entriesWithHtml.push({ title: titleOf(item), kinds: [...new Set(kept)] });
  }
  if (typeof details.renamedFrom === "string" && typeof details.renamedTo === "string") {
    report.renamedSlugs.push({
      title: titleOf(item),
      from: details.renamedFrom,
      to: details.renamedTo,
    });
  }
  if (details.redirected === true) {
    report.redirectsSuggested += 1;
  }
}

function titleOf(item: ReportedItem): string {
  const payload = item.payload;
  for (const key of ["title", "name", "displayName", "url"]) {
    const value = payload[key];
    if (typeof value === "string" && value !== "") {
      return value;
    }
  }
  return item.kind;
}
