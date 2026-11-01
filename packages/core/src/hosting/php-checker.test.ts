import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * lintel-check.php, for hosting that may only run PHP. Run from the command line it prints
 * its findings as JSON; this machine has no Node.js Selector, so it recommends publishing.
 */
const hasPhp = spawnSync("php", ["--version"]).status === 0;

describe.skipIf(!hasPhp)("the PHP hosting checker", () => {
  it("recommends publishing the site as files where Node.js apps aren't offered", () => {
    const result = spawnSync("php", [join(import.meta.dirname, "files", "lintel-check.php")], {
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.facts.selector).toBe(false);
    expect(report.path).toBe("publish");
    expect(report.headline).toBe("Publish your site here from Lintel");
    expect(report.facts.php).toMatch(/^\d+\.\d+/);
  });
});
