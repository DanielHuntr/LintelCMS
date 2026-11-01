import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type TestInfo } from "@playwright/test";

/**
 * Runs axe-core on what the page shows now and fails on serious or critical problems,
 * with a report a person can act on: what is wrong, where, and how to fix it.
 * Minor and moderate findings are attached to the test for review but don't fail it.
 */

type AxeResults = Awaited<ReturnType<AxeBuilder["analyze"]>>;
type Violation = AxeResults["violations"][number];

const FAILING_IMPACTS = new Set(["serious", "critical"]);

/** WCAG 2.2 A and AA, which is what Lintel promises. */
const STANDARDS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

export async function expectNoSeriousAccessibilityProblems(
  page: Page,
  screen: string,
  testInfo: TestInfo,
): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(STANDARDS).analyze();
  await testInfo.attach(`axe ${screen}.json`, {
    body: JSON.stringify(results.violations, null, 2),
    contentType: "application/json",
  });

  const failing = results.violations.filter((violation) =>
    FAILING_IMPACTS.has(violation.impact ?? ""),
  );
  // Compared by rule, so the report above is what's read rather than a large object diff.
  expect(
    failing.map((violation) => violation.id),
    describeViolations(screen, failing),
  ).toEqual([]);
}

export function describeViolations(screen: string, violations: Violation[]): string {
  if (violations.length === 0) {
    return `${screen}: no serious accessibility problems`;
  }
  const problems = violations.map((violation) => {
    const places = violation.nodes
      .slice(0, 5)
      .map((node) => `      at ${node.target.join(" ")}\n        ${firstLine(node.failureSummary)}`)
      .join("\n");
    const more =
      violation.nodes.length > 5 ? `\n      ...and ${violation.nodes.length - 5} more` : "";
    return (
      `  [${violation.impact}] ${violation.help} (${violation.id})\n` +
      `    How to fix: ${violation.helpUrl}\n${places}${more}`
    );
  });
  return `${screen} has ${violations.length} serious accessibility problem(s):\n${problems.join("\n")}`;
}

function firstLine(summary: string | undefined): string {
  return (summary ?? "").split("\n").slice(0, 2).join(" ").trim();
}
