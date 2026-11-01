/**
 * Version numbers as Lintel's releases use them: semantic versions such as 1.2.0,
 * 1.2.0-rc.1 or 1.2.0-beta.3, with an optional leading "v" (as in the git tag v1.2.0).
 * Comparison follows semver.org: a pre-release comes before its release
 * (1.2.0-rc.1 < 1.2.0), numeric parts compare as numbers (rc.10 > rc.9), and build
 * metadata (+...) is ignored.
 */
export interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
  /** "rc.1" → ["rc", 1]; empty for a release. */
  prerelease: Array<string | number>;
}

const VERSION_PATTERN =
  /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z.-]+)?$/;

/** The version, or null when the text isn't one. */
export function parseVersion(text: string): SemanticVersion | null {
  const match = VERSION_PATTERN.exec(text.trim());
  if (!match) {
    return null;
  }
  const [, major, minor, patch, prerelease] = match;
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    prerelease: prerelease
      ? prerelease.split(".").map((part) => (/^\d+$/.test(part) ? Number(part) : part))
      : [],
  };
}

export function isVersion(text: string): boolean {
  return parseVersion(text) !== null;
}

/** "v1.2.0" → "1.2.0", "1.2.0+build.5" → "1.2.0". Throws for text that isn't a version. */
export function normaliseVersion(text: string): string {
  const version = parseVersion(text);
  if (!version) {
    throw new Error(`"${text}" isn't a version number such as 1.2.0`);
  }
  const core = `${version.major}.${version.minor}.${version.patch}`;
  return version.prerelease.length > 0 ? `${core}-${version.prerelease.join(".")}` : core;
}

/** Negative when `left` is older, positive when newer, 0 when they are the same version. */
export function compareVersions(left: string, right: string): number {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) {
    throw new Error(`Can't compare "${left}" with "${right}": both must be version numbers`);
  }
  return (
    a.major - b.major ||
    a.minor - b.minor ||
    a.patch - b.patch ||
    comparePrereleases(a.prerelease, b.prerelease)
  );
}

export function isNewerVersion(candidate: string, than: string): boolean {
  return compareVersions(candidate, than) > 0;
}

export function isPrerelease(text: string): boolean {
  return (parseVersion(text)?.prerelease.length ?? 0) > 0;
}

/** Newest first. */
export function sortNewestFirst<Item>(items: readonly Item[], versionOf: (item: Item) => string) {
  return [...items].sort((left, right) => compareVersions(versionOf(right), versionOf(left)));
}

function comparePrereleases(
  left: ReadonlyArray<string | number>,
  right: ReadonlyArray<string | number>,
): number {
  // A version without a pre-release part is the release itself, so it comes last.
  if (left.length === 0 || right.length === 0) {
    return right.length - left.length;
  }
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const a = left[index];
    const b = right[index];
    if (a === undefined) return -1;
    if (b === undefined) return 1;
    if (a === b) continue;
    if (typeof a === "number" && typeof b === "number") return a - b;
    // Numeric identifiers always have lower precedence than alphanumeric ones.
    if (typeof a === "number") return -1;
    if (typeof b === "number") return 1;
    return a < b ? -1 : 1;
  }
  return 0;
}
