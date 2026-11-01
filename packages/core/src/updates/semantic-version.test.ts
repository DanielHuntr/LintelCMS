import { describe, expect, it } from "vitest";
import {
  compareVersions,
  isNewerVersion,
  isPrerelease,
  normaliseVersion,
  parseVersion,
  sortNewestFirst,
} from "./semantic-version.js";

describe("version numbers", () => {
  it("reads versions with or without the tag's v, and refuses anything else", () => {
    expect(parseVersion("v1.2.3")).toEqual({ major: 1, minor: 2, patch: 3, prerelease: [] });
    expect(parseVersion("1.0.0-rc.1")?.prerelease).toEqual(["rc", 1]);
    expect(normaliseVersion("v2.0.0+build.7")).toBe("2.0.0");
    for (const text of ["1.2", "latest", "01.2.3", "1.2.3-", "v"]) {
      expect(parseVersion(text), text).toBeNull();
    }
  });

  it("orders releases, release candidates and betas as semver does", () => {
    const ordered = [
      "1.0.0-alpha",
      "1.0.0-alpha.1",
      "1.0.0-beta",
      "1.0.0-beta.2",
      "1.0.0-beta.11",
      "1.0.0-rc.1",
      "1.0.0",
      "1.0.1",
      "1.1.0-rc.1",
      "1.1.0",
      "2.0.0",
    ];
    for (let index = 1; index < ordered.length; index += 1) {
      const older = ordered[index - 1] ?? "";
      const newer = ordered[index] ?? "";
      expect(compareVersions(older, newer), `${older} < ${newer}`).toBeLessThan(0);
      expect(isNewerVersion(newer, older)).toBe(true);
    }
    expect(compareVersions("v1.2.0", "1.2.0")).toBe(0);
    expect(sortNewestFirst(["1.0.0-rc.2", "1.0.0", "0.9.0"], (version) => version)).toEqual([
      "1.0.0",
      "1.0.0-rc.2",
      "0.9.0",
    ]);
  });

  it("knows a pre-release when it sees one", () => {
    expect(isPrerelease("1.0.0-rc.1")).toBe(true);
    expect(isPrerelease("1.0.0")).toBe(false);
  });
});
