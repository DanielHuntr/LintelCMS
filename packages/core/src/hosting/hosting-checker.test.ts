import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { HostingChecker } from "../cli/hosting-checker.js";

const checker = createRequire(import.meta.url)("./files/lintel-check.cjs") as HostingChecker;

/** A server that can run Lintel; each test changes one thing. */
function goodServer(changes: Record<string, unknown> = {}) {
  return {
    nodeVersion: "22.12.0",
    platform: "linux",
    architecture: "x64",
    totalMemoryMb: 16000,
    memoryLimitMb: 2048,
    addressSpaceLimitMb: undefined,
    webAssemblyProblem: undefined,
    folders: [{ folder: "/home/ana/lintel", writable: true }],
    sharp: { state: "loaded" },
    outboundHttps: { ok: true },
    passenger: true,
    ...changes,
  };
}

function statusOf(facts: object, name: string) {
  return checker.buildReport(facts).checks.find((check) => check.name === name)?.status;
}

describe("the hosting checker's report", () => {
  it("says plainly that Lintel will run on a good server", () => {
    const report = checker.buildReport(goodServer());
    expect(report.verdict).toBe("runs");
    expect(report.headline).toBe("Lintel will run here.");
    expect(report.askHost).toEqual([]);
  });

  it("blocks an old Node.js and says what to ask the host", () => {
    const report = checker.buildReport(goodServer({ nodeVersion: "18.20.4" }));
    expect(report.verdict).toBe("blocked");
    expect(report.headline).toBe("Lintel can't run here yet.");
    expect(report.askHost).toContain("Please add Node.js 22 (or newer) to the Node.js Selector.");
  });

  it("judges memory by the account's limit, not the machine's", () => {
    expect(statusOf(goodServer({ memoryLimitMb: 256 }), "Memory")).toBe("fail");
    expect(statusOf(goodServer({ memoryLimitMb: 768 }), "Memory")).toBe("warn");
    expect(statusOf(goodServer({ memoryLimitMb: undefined, totalMemoryMb: 4096 }), "Memory")).toBe(
      "pass",
    );
  });

  it("points to Postgres when a virtual memory limit stops the built-in database", () => {
    const report = checker.buildReport(goodServer({ addressSpaceLimitMb: 1024 }));
    expect(report.verdict).toBe("runs-with-limits");
    const database = report.checks.find((check) => check.name === "Built-in database");
    expect(database?.detail).toContain("PostgreSQL");
  });

  it("blocks folders Lintel can't write to", () => {
    const facts = goodServer({
      folders: [{ folder: "/home/ana/lintel/.lintel", writable: false, problem: "EACCES" }],
    });
    expect(statusOf(facts, "Saving files")).toBe("fail");
  });

  it("only notes image resizing and internet access, which Lintel can run without", () => {
    const report = checker.buildReport(
      goodServer({
        sharp: { state: "failed", problem: "Could not load the sharp module" },
        outboundHttps: { ok: false, problem: "ETIMEDOUT" },
      }),
    );
    expect(report.verdict).toBe("runs-with-limits");
    expect(checker.formatText(report)).toContain("images are shown at the size they were uploaded");
    expect(report.askHost).toContain(
      "Please allow outgoing HTTPS connections (port 443) from my Node.js app.",
    );
  });

  describe("on this machine", () => {
    let folder: string | undefined;
    afterEach(async () => {
      if (folder) await rm(folder, { recursive: true, force: true });
    });

    it("gathers real facts and makes a report from them", async () => {
      folder = await mkdtemp(join(tmpdir(), "lintel-check-"));
      const facts = await new Promise<Record<string, unknown>>((resolve) =>
        checker.gatherFacts(folder ?? "", (gathered) =>
          resolve(gathered as Record<string, unknown>),
        ),
      );
      expect(facts.nodeVersion).toBe(process.versions.node);
      expect(facts.folders).toEqual([
        { folder, writable: true },
        { folder: join(folder, ".lintel"), writable: true },
        { folder: join(folder, "tmp"), writable: true },
      ]);
      expect(checker.buildReport(facts).checks.length).toBeGreaterThan(4);
    }, 20_000);
  });
});
