import type { PageDocument, PageNode } from "@lintel/builder-model";
import { t } from "../i18n/strings.js";
import type { ExperimentGoal, VersionKey, VersionResult } from "./experiments.types.js";

/** Plain-English words for tests: version names, goals and verdicts. Pure, so it is tested. */

export function versionName(key: VersionKey): string {
  return key === "original" ? t("experiments.version.original") : t(`experiments.version.${key}`);
}

/** "Version B" → "B", for tight spaces such as the designer's toolbar. */
export function versionLetter(key: VersionKey): string {
  return key === "original" ? t("experiments.version.original") : key.toUpperCase();
}

/** What the goal is, in a few words: "Someone clicks “Book a table”". */
export function describeGoal(goal: ExperimentGoal | null, pageTitle?: string): string {
  if (!goal) return t("experiments.goal.none");
  switch (goal.kind) {
    case "form":
      return t("experiments.goal.formSummary");
    case "order":
      return t("experiments.goal.orderSummary");
    case "click":
      return t("experiments.goal.clickSummary", { link: goal.label || goal.target });
    case "page":
      return t("experiments.goal.pageSummary", { page: pageTitle || t("experiments.goal.aPage") });
    case "analytics":
      return describeAnalyticsGoal(goal.name);
  }
}

/** A goal Visitors counts, by its name there: "form:contact", "order" or "signup". */
export function describeAnalyticsGoal(name: string): string {
  if (name === "order") return t("experiments.goal.orderSummary");
  if (name.startsWith("form:"))
    return t("experiments.goal.namedFormSummary", { form: name.slice(5) });
  return t("experiments.goal.eventSummary", { event: name });
}

/** What was counted, in words: "12 sent a form", "3 ordered". */
export function conversionWord(goal: ExperimentGoal | null, count: number): string {
  return t(`experiments.results.did.${goal?.kind ?? "form"}`, { count });
}

function percent(rate: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "percent",
    maximumFractionDigits: rate > 0 && rate < 0.1 ? 1 : 0,
  }).format(rate);
}

export function formatRate(rate: number): string {
  return percent(rate);
}

/** "+23%" or "−8%" against the original; empty when there is nothing to compare. */
export function formatDifference(relativeDifference: number | null): string {
  if (relativeDifference === null) return "";
  const formatted = percent(Math.abs(relativeDifference));
  if (Math.abs(relativeDifference) < 0.005) return t("experiments.results.same");
  return relativeDifference > 0 ? `+${formatted}` : `−${formatted}`;
}

/** One sentence on how a version is doing against the original. */
export function verdictSentence(result: VersionResult): string {
  const comparison = result.comparison;
  if (!comparison) return "";
  const version = versionLetter(result.key);
  const sure = comparison.sureness;
  switch (comparison.verdict) {
    case "noData":
      return t("experiments.verdict.noData");
    case "aheadTooEarly":
      return t("experiments.verdict.aheadTooEarly", { version });
    case "behindTooEarly":
      return t("experiments.verdict.behindTooEarly", { version });
    case "tooClose":
      return t("experiments.verdict.tooClose", { version });
    case "better":
      return t("experiments.verdict.better", { version, sure });
    case "worse":
      return t("experiments.verdict.worse", { version, sure });
  }
}

export interface LinkOnPage {
  href: string;
  label: string;
}

/** Every button and link on the designs, once each, for "a click on…". */
export function linksOnPages(designs: readonly (PageDocument | null | undefined)[]): LinkOnPage[] {
  const found = new Map<string, LinkOnPage>();
  const visit = (node: PageNode) => {
    const href = node.props.href;
    if (typeof href === "string" && href.trim() !== "" && !found.has(href)) {
      const words = [node.props.label, node.props.text, node.name].find(
        (candidate): candidate is string =>
          typeof candidate === "string" && candidate.trim() !== "",
      );
      found.set(href, { href, label: words ?? href });
    }
    node.children.forEach(visit);
  };
  for (const design of designs) if (design) visit(design.root);
  return [...found.values()];
}
