import { spawn } from "node:child_process";
import { compareVersions, isNewerVersion, isVersion, normaliseVersion } from "@lintel/core/updates";
import { CommandError, type Terminal } from "../terminal.js";

/**
 * `lintel update` for a git clone (`pnpm dev`, or a server run from the repository):
 *
 *   1. refuses to start if any tracked file has changes, so nobody's work is touched;
 *   2. fetches, and picks the release tag (v1.2.0) asked for, or the newest one, or, when the
 *      repository has no release tags, the latest commit of the branch;
 *   3. makes a backup while the old version's code is still checked out;
 *   4. checks the new version out, then runs `pnpm install` and the migrations;
 *   5. says to start `pnpm dev` again.
 *
 * Commands run through `run`, so tests can use a real temporary repository with pretend
 * installs and migrations.
 */
export interface CommandResult {
  code: number;
  output: string;
}

export type RunCommand = (
  command: string,
  argumentList: string[],
  folder: string,
) => Promise<CommandResult>;

export interface GitUpdateOptions {
  repositoryFolder: string;
  currentVersion: string;
  /** A version (1.2.0 or v1.2.0) to go to; the newest release tag when left out. */
  toVersion?: string;
  /** For repositories without release tags: the branch to follow (the one checked out by default). */
  branch?: string;
  run: RunCommand;
  /** Backs the site up; resolves with where the backup went. */
  makeBackup: () => Promise<string>;
  terminal: Terminal;
}

export async function updateFromGit(options: GitUpdateOptions): Promise<number> {
  const { terminal } = options;
  const git = (...argumentList: string[]) => runOrFail(options, "git", argumentList);

  if (
    (await options.run("git", ["rev-parse", "--is-inside-work-tree"], options.repositoryFolder))
      .code !== 0
  ) {
    throw new CommandError(
      "This folder isn't a git repository, so `lintel update` can't update it. " +
        "Settings → Updates in the admin says how this copy of Lintel is updated.",
    );
  }
  const changed = (await git("status", "--porcelain", "--untracked-files=no")).trim();
  if (changed) {
    throw new CommandError(
      [
        "You have changes that aren't committed, so nothing was updated:",
        ...changed.split("\n").map((line) => `  ${line}`),
        "",
        "Commit them (or `git stash` them), then run `pnpm lintel update` again.",
      ].join("\n"),
    );
  }

  const remotes = (await git("remote")).split("\n").filter(Boolean);
  const remote = remotes.includes("origin") ? "origin" : remotes[0];
  if (remote) {
    terminal.say(`Fetching the latest from ${remote}…`);
    await git("fetch", "--tags", remote);
  } else {
    terminal.say("This repository has no remote to fetch from; using what is here already.");
  }

  const target = await chooseTarget(options, remote, git);
  if (!target) {
    terminal.say(`You're up to date: Lintel ${options.currentVersion} is the newest release.`);
    return 0;
  }

  terminal.say("Backing up the site first…");
  const backup = await options.makeBackup();
  terminal.say(`Saved ${backup}.`);

  terminal.say(`Switching to ${target.description}…`);
  if (target.kind === "tag") {
    await git("checkout", "--quiet", "--detach", target.ref);
  } else {
    await git("checkout", "--quiet", target.branch);
    if (remote) await git("merge", "--ff-only", "--quiet", `${remote}/${target.branch}`);
  }

  terminal.say("Installing packages (pnpm install)…");
  await runOrFail(options, "pnpm", ["install"]);
  terminal.say("Bringing the database up to date…");
  await runOrFail(options, "pnpm", ["--silent", "lintel", "migrate"]);

  terminal.say();
  terminal.say(`Updated to ${target.description}. Start Lintel again (pnpm dev) to use it.`);
  terminal.say(`If something is wrong, \`pnpm lintel restore ${backup}\` puts the site back.`);
  return 0;
}

type Target =
  | { kind: "tag"; ref: string; description: string }
  | { kind: "branch"; branch: string; description: string };

async function chooseTarget(
  options: GitUpdateOptions,
  remote: string | undefined,
  git: (...argumentList: string[]) => Promise<string>,
): Promise<Target | null> {
  const tags = (await git("tag", "--list"))
    .split("\n")
    .map((tag) => tag.trim())
    .filter((tag) => tag && isVersion(tag));

  if (options.toVersion) {
    if (!isVersion(options.toVersion)) {
      throw new CommandError(`"${options.toVersion}" isn't a version number such as 1.2.0.`);
    }
    const wanted = normaliseVersion(options.toVersion);
    const tag = tags.find((candidate) => normaliseVersion(candidate) === wanted);
    if (!tag) {
      throw new CommandError(
        `There is no release tag for Lintel ${wanted} (looked for v${wanted}).`,
      );
    }
    return { kind: "tag", ref: tag, description: `Lintel ${wanted}` };
  }

  if (tags.length > 0 && !options.branch) {
    const newest = [...tags].sort((left, right) => compareVersions(right, left))[0] ?? "";
    return isNewerVersion(newest, options.currentVersion)
      ? { kind: "tag", ref: newest, description: `Lintel ${normaliseVersion(newest)}` }
      : null;
  }

  const branch = options.branch ?? (await git("rev-parse", "--abbrev-ref", "HEAD")).trim();
  if (branch === "HEAD") {
    throw new CommandError(
      "No branch is checked out, so there is nothing to follow. Use --to <version> or --branch <name>.",
    );
  }
  const onBranch = (await git("rev-parse", "--abbrev-ref", "HEAD")).trim() === branch;
  const behind = remote
    ? Number((await git("rev-list", "--count", `HEAD..${remote}/${branch}`)).trim())
    : 0;
  if (onBranch && behind === 0) {
    return null;
  }
  return { kind: "branch", branch, description: `the latest ${branch}` };
}

async function runOrFail(options: GitUpdateOptions, command: string, argumentList: string[]) {
  const result = await options.run(command, argumentList, options.repositoryFolder);
  if (result.code !== 0) {
    throw new CommandError(
      `\`${command} ${argumentList.join(" ")}\` didn't work:\n${result.output.trim()}`,
    );
  }
  return result.output;
}

/** Runs a program and collects what it prints. */
export const runCommand: RunCommand = (command, argumentList, folder) =>
  new Promise((resolve) => {
    const child = spawn(command, argumentList, {
      cwd: folder,
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.once("error", (error) => resolve({ code: 1, output: error.message }));
    child.once("exit", (code) => resolve({ code: code ?? 1, output }));
  });
