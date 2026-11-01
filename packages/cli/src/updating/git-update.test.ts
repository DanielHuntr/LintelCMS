import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CommandError, type Terminal } from "../terminal.js";
import { type RunCommand, runCommand, updateFromGit } from "./git-update.js";

function recordingTerminal(): Terminal & { lines: string[] } {
  const lines: string[] = [];
  return {
    lines,
    say: (line = "") => lines.push(line),
    warn: (line) => lines.push(`warning: ${line}`),
    ask: async () => "",
    workingFolder: "/",
  };
}

describe("lintel update from a git clone", { timeout: 60_000 }, () => {
  let folder: string;
  let origin: string;
  let clone: string;
  let otherCommands: string[];
  let backups: number;

  const git = (cwd: string, ...argumentList: string[]) =>
    execFileSync(
      "git",
      [
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.com",
        "-c",
        "init.defaultBranch=main",
        ...argumentList,
      ],
      { cwd, encoding: "utf8" },
    ).trim();

  async function commitVersion(version: string, tag: boolean) {
    await writeFile(join(origin, "version.txt"), version);
    git(origin, "add", "version.txt");
    git(origin, "commit", "--quiet", "-m", `Lintel ${version}`);
    if (tag) git(origin, "tag", `v${version}`);
  }

  // Real git; pnpm install and the migrations are only noted.
  const run: RunCommand = async (command, argumentList, cwd) => {
    if (command === "git") return runCommand(command, argumentList, cwd);
    otherCommands.push(`${command} ${argumentList.join(" ")}`);
    return { code: 0, output: "" };
  };

  function update(options: { toVersion?: string; branch?: string; currentVersion?: string } = {}) {
    const terminal = recordingTerminal();
    const result = updateFromGit({
      repositoryFolder: clone,
      currentVersion: options.currentVersion ?? "1.0.0",
      toVersion: options.toVersion,
      branch: options.branch,
      run,
      makeBackup: async () => {
        backups += 1;
        return "/backups/lintel-backup.zip";
      },
      terminal,
    });
    return { result, terminal };
  }

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "lintel-git-update-"));
    origin = join(folder, "origin");
    clone = join(folder, "clone");
    otherCommands = [];
    backups = 0;
    execFileSync("git", ["init", "--quiet", "-b", "main", origin]);
    await commitVersion("1.0.0", true);
    execFileSync("git", ["clone", "--quiet", origin, clone]);
  });
  afterEach(() => rm(folder, { recursive: true, force: true }));

  it("updates to the newest release tag: backup, checkout, install, migrations", async () => {
    await commitVersion("1.1.0", true);

    const { result, terminal } = update();

    expect(await result).toBe(0);
    expect(await readFile(join(clone, "version.txt"), "utf8")).toBe("1.1.0");
    expect(git(clone, "describe", "--tags")).toBe("v1.1.0");
    expect(backups).toBe(1);
    expect(otherCommands).toEqual(["pnpm install", "pnpm --silent lintel migrate"]);
    expect(terminal.lines.join("\n")).toContain(
      "Updated to Lintel 1.1.0. Start Lintel again (pnpm dev)",
    );
  });

  it("goes to the version asked for, and says when there is no such tag", async () => {
    await commitVersion("1.1.0", true);
    await commitVersion("1.2.0", true);

    expect(await update({ toVersion: "v1.1.0" }).result).toBe(0);
    expect(await readFile(join(clone, "version.txt"), "utf8")).toBe("1.1.0");
    await expect(update({ toVersion: "3.0.0" }).result).rejects.toThrow(/no release tag/);
  });

  it("never touches uncommitted work", async () => {
    await commitVersion("1.1.0", true);
    await writeFile(join(clone, "version.txt"), "my own change");

    await expect(update().result).rejects.toThrow(CommandError);
    await expect(update().result).rejects.toThrow(/changes that aren't committed/);
    expect(await readFile(join(clone, "version.txt"), "utf8")).toBe("my own change");
    expect(backups).toBe(0);
    expect(otherCommands).toEqual([]);
  });

  it("says so when it's already up to date", async () => {
    const { result, terminal } = update();
    expect(await result).toBe(0);
    expect(terminal.lines.at(-1)).toBe("You're up to date: Lintel 1.0.0 is the newest release.");
    expect(backups).toBe(0);
  });

  it("follows the branch when the repository has no release tags", async () => {
    git(origin, "tag", "-d", "v1.0.0");
    git(clone, "tag", "-d", "v1.0.0");
    await commitVersion("1.1.0-dev", false);

    expect(await update().result).toBe(0);
    expect(await readFile(join(clone, "version.txt"), "utf8")).toBe("1.1.0-dev");
    expect(git(clone, "rev-parse", "--abbrev-ref", "HEAD")).toBe("main");
    expect(backups).toBe(1);

    expect(await update().result).toBe(0);
    expect(backups).toBe(1);
  });

  it("explains a folder that isn't a git repository", async () => {
    clone = folder;
    await expect(update().result).rejects.toThrow(/isn't a git repository/);
  });
});
