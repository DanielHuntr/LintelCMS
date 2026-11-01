import { lintelVersion } from "@lintel/core/updates";
import { describe, expect, it } from "vitest";
import { runCommandLine } from "./command-line.js";
import { printPlan } from "./commands/import.js";
import { describeStatus } from "./commands/migrate.js";
import { formatBytes, formatTable, resolvePath, type Terminal } from "./terminal.js";

/** A terminal that keeps what was said, for checking. */
function recordingTerminal(answers: string[] = []): Terminal & { lines: string[] } {
  const lines: string[] = [];
  return {
    lines,
    say: (line = "") => lines.push(line),
    warn: (line) => lines.push(`warning: ${line}`),
    ask: async () => answers.shift() ?? "",
    workingFolder: "/home/ana/site",
  };
}

describe("the lintel command", () => {
  it("lists every command when run without one", async () => {
    const terminal = recordingTerminal();
    expect(await runCommandLine([], terminal)).toBe(0);
    const help = terminal.lines.join("\n");
    for (const name of [
      "start",
      "update",
      "doctor",
      "backup",
      "restore",
      "export",
      "import",
      "migrate",
      "model",
      "create-admin",
    ]) {
      expect(help).toContain(`  ${name} `);
    }
  });

  it("says which version of Lintel this is", async () => {
    for (const flag of ["--version", "-v", "version"]) {
      const terminal = recordingTerminal();
      expect(await runCommandLine([flag], terminal)).toBe(0);
      expect(terminal.lines).toEqual([`Lintel ${lintelVersion()}`]);
    }
    expect(lintelVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("says when a command doesn't exist, and fails", async () => {
    const terminal = recordingTerminal();
    expect(await runCommandLine(["bakcup"], terminal)).toBe(1);
    expect(terminal.lines[0]).toBe('warning: There is no "bakcup" command.');
  });

  it("shows a command's options with --help", async () => {
    const terminal = recordingTerminal();
    expect(await runCommandLine(["restore", "--help"], terminal)).toBe(0);
    expect(terminal.lines).toContain("Usage: pnpm lintel restore <backup.zip> [--dry-run] [--yes]");
  });

  it("explains a wrong option instead of crashing", async () => {
    const terminal = recordingTerminal();
    expect(await runCommandLine(["backup", "--colour", "red"], terminal)).toBe(1);
    expect(terminal.lines.join("\n")).toContain("Usage: pnpm lintel backup");
  });

  it("asks which file when restore or import is given none", async () => {
    const terminal = recordingTerminal();
    expect(await runCommandLine(["restore"], terminal)).toBe(1);
    expect(terminal.lines[0]).toContain("Which backup?");
    expect(await runCommandLine(["import", "--strategy", "merge", "file.zip"], terminal)).toBe(1);
    expect(terminal.lines.join("\n")).toContain("--strategy should be skip or overwrite");
  });
});

describe("terminal output", () => {
  it("lines tables up in columns", () => {
    expect(
      formatTable([
        ["Table", "Now"],
        ["entries", "12"],
      ]),
    ).toEqual(["Table    Now", "entries  12"]);
  });

  it("writes sizes the way people read them", () => {
    expect(formatBytes(512)).toBe("512 bytes");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(250 * 1024 * 1024)).toBe("250 MB");
  });

  it("reads paths from where the person ran the command", () => {
    expect(resolvePath(recordingTerminal(), "backups/site.zip")).toBe(
      "/home/ana/site/backups/site.zip",
    );
    expect(resolvePath(recordingTerminal(), "/tmp/site.zip")).toBe("/tmp/site.zip");
  });

  it("prints an import plan as a table, with notes", () => {
    const terminal = recordingTerminal();
    const empty = { create: 0, update: 0, skip: 0 };
    printPlan(
      terminal,
      {
        strategy: "skip",
        totals: {
          blueprint: empty,
          collection: { create: 0, update: 0, skip: 2 },
          taxonomy: empty,
          term: empty,
          global: empty,
          menu: empty,
          media: empty,
          entry: { create: 3, update: 0, skip: 1 },
        },
        items: [],
        warnings: ["photo.jpg isn't in the export, so it can't be added."],
      },
      true,
    );
    expect(terminal.lines).toEqual([
      "               Would add  Would update  Already here",
      "  Collections  0          0             2",
      "  Entries      3          0             1",
      "warning: Note: photo.jpg isn't in the export, so it can't be added.",
      "Nothing was changed (dry run).",
    ]);
  });

  it("says how far behind the database's tables are", () => {
    expect(describeStatus(9, 9)).toBe("The tables are up to date (9 migrations).");
    expect(describeStatus(7, 9)).toContain("2 migrations still to apply");
    expect(describeStatus(10, 9)).toContain("newer Lintel");
  });
});
