import type { ImportReport } from "./shopifyImport.api.js";

/**
 * The report's redirects as a CSV file (from,to), for sites that set redirects up somewhere
 * else, such as their host or CDN.
 */
export function redirectsCsv(redirects: ImportReport["redirects"]): string {
  const quote = (value: string) =>
    /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  return ["from,to", ...redirects.map((item) => `${quote(item.fromPath)},${quote(item.toPath)}`)]
    .join("\n")
    .concat("\n");
}

/** Problems grouped by the item they're about, so a product's three photos read as one entry. */
export function groupProblems(
  problems: ImportReport["problems"],
): Array<{ item: string; stage: string; messages: string[] }> {
  const groups = new Map<string, { item: string; stage: string; messages: string[] }>();
  for (const problem of problems) {
    const key = `${problem.stage}:${problem.item}`;
    const group = groups.get(key) ?? { item: problem.item, stage: problem.stage, messages: [] };
    group.messages.push(problem.message);
    groups.set(key, group);
  }
  return [...groups.values()];
}
