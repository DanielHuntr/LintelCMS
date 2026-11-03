import { compareVersions, isVersion } from "../updates/semantic-version.js";

/**
 * Whether a Lintel version is inside the range an add-on says it works with. Ranges are
 * written as npm writes them, kept to the forms add-ons need:
 *
 *   ">=1.0.0-rc.1"            this version or newer
 *   ">=1.0.0 <2.0.0"          every condition must hold
 *   "^1.0.0"                  this version up to (not including) the next major one
 *   "~1.2.0"                  this version up to the next minor one
 *   "1.2.0"                   exactly this version
 *   "^1.0.0 || ^2.0.0"        either range
 *   "*"                       any version
 *
 * A range Lintel can't read counts as not matching, so a typo never lets an add-on in.
 */
export function isVersionInRange(version: string, range: string): boolean {
  if (!isVersion(version)) return false;
  return range.split("||").some((alternative) => {
    const conditions = alternative.trim().split(/\s+/).filter(Boolean);
    return conditions.length > 0 && conditions.every((condition) => meets(version, condition));
  });
}

/** Whether Lintel can read the range at all. */
export function isReadableRange(range: string): boolean {
  return range.split("||").every((alternative) => {
    const conditions = alternative.trim().split(/\s+/).filter(Boolean);
    return conditions.length > 0 && conditions.every((condition) => readCondition(condition));
  });
}

type Condition = { operator: ">=" | ">" | "<=" | "<" | "=" | "^" | "~"; version: string } | "any";

function readCondition(text: string): Condition | null {
  if (text === "*" || text === "x") return "any";
  const match = /^(>=|<=|>|<|=|\^|~)?v?(.+)$/.exec(text);
  if (!match?.[2] || !isVersion(match[2])) return null;
  const operator = (match[1] ?? "=") as Exclude<Condition, "any">["operator"];
  return { operator, version: match[2] };
}

function meets(version: string, text: string): boolean {
  const condition = readCondition(text);
  if (condition === null) return false;
  if (condition === "any") return true;
  const compared = compareVersions(version, condition.version);
  switch (condition.operator) {
    case ">=":
      return compared >= 0;
    case ">":
      return compared > 0;
    case "<=":
      return compared <= 0;
    case "<":
      return compared < 0;
    case "=":
      return compared === 0;
    case "^":
      return compared >= 0 && compareVersions(version, nextBreaking(condition.version)) < 0;
    case "~":
      return compared >= 0 && compareVersions(version, nextMinor(condition.version)) < 0;
  }
}

/** The first version a caret range leaves out: 1.2.3 → 2.0.0-0, 0.2.3 → 0.3.0-0. */
function nextBreaking(version: string): string {
  const [major = 0, minor = 0, patch = 0] = numbers(version);
  if (major > 0) return `${major + 1}.0.0-0`;
  if (minor > 0) return `0.${minor + 1}.0-0`;
  return `0.0.${patch + 1}-0`;
}

function nextMinor(version: string): string {
  const [major = 0, minor = 0] = numbers(version);
  return `${major}.${minor + 1}.0-0`;
}

function numbers(version: string): number[] {
  return version.replace(/^v/, "").split(/[-+]/)[0]!.split(".").map(Number);
}
