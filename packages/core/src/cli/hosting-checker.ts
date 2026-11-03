import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The hosting checker is one plain JavaScript file (src/hosting/files/lintel-check.cjs),
 * so people can upload it on its own before installing anything. `lintel doctor --hosting`
 * runs the same checks; these types describe what it exports.
 */
export type CheckStatus = "pass" | "warn" | "fail";

export interface HostingCheck {
  name: string;
  status: CheckStatus;
  detail: string;
  askHost?: string;
}

export interface HostingReport {
  verdict: "runs" | "runs-with-limits" | "blocked";
  headline: string;
  checks: HostingCheck[];
  askHost: string[];
}

export interface HostingChecker {
  gatherFacts(appFolder: string, callback: (facts: object) => void, folders?: string[]): void;
  buildReport(facts: object): HostingReport;
  formatText(report: HostingReport): string;
}

/**
 * In the hosting package it sits beside app.js; elsewhere it is in hosting/files, beside
 * this file's folder in both src and dist (the build copies it).
 */
export function findHostingChecker(root: string): HostingChecker {
  const candidates = [
    join(root, "lintel-check.js"),
    fileURLToPath(new URL("../hosting/files/lintel-check.cjs", import.meta.url)),
  ];
  const file = candidates.find((candidate) => existsSync(candidate));
  if (!file) {
    throw new Error("The hosting checker (lintel-check.js) is missing from this copy of Lintel.");
  }
  const loaded: unknown = createRequire(import.meta.url)(file);
  if (!isHostingChecker(loaded)) {
    throw new Error(`${file} isn't Lintel's hosting checker.`);
  }
  return loaded;
}

function isHostingChecker(value: unknown): value is HostingChecker {
  return (
    typeof value === "object" &&
    value !== null &&
    "gatherFacts" in value &&
    typeof value.gatherFacts === "function" &&
    "buildReport" in value &&
    typeof value.buildReport === "function" &&
    "formatText" in value &&
    typeof value.formatText === "function"
  );
}

export function runHostingChecks(
  checker: HostingChecker,
  appFolder: string,
  folders?: string[],
): Promise<HostingReport> {
  return new Promise((resolve) => {
    checker.gatherFacts(appFolder, (facts) => resolve(checker.buildReport(facts)), folders);
  });
}
