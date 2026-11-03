import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPOSITORY_ROOT } from "../plugins/installed-plugins.js";

/**
 * deploy/install.sh, the one-command VPS installer. Its dry run prints every step without
 * changing anything, so the steps can be checked here; ShellCheck catches shell mistakes
 * when it is installed (CI installs it).
 */
const SCRIPT = join(REPOSITORY_ROOT, "deploy", "install.sh");

// The dry run plans for Ubuntu wherever the tests run (Windows and macOS have no os-release).
const UBUNTU_RELEASE = join(mkdtempSync(join(tmpdir(), "lintel-os-release-")), "os-release");
writeFileSync(UBUNTU_RELEASE, 'ID=ubuntu\nID_LIKE=debian\nPRETTY_NAME="Ubuntu 24.04 LTS"\n');

function dryRun(...options: string[]) {
  return spawnSync("bash", [SCRIPT, "--dry-run", "--dir", "/tmp/lintel-dry-run", ...options], {
    encoding: "utf8",
    input: "",
    env: { ...process.env, LINTEL_OS_RELEASE_FILE: UBUNTU_RELEASE.replaceAll("\\", "/") },
  });
}

function findShellCheck(): string | undefined {
  for (const candidate of ["shellcheck", join(homedir(), ".local", "bin", "shellcheck")]) {
    if (spawnSync(candidate, ["--version"]).status === 0) return candidate;
  }
  return undefined;
}

describe("the VPS installer", () => {
  const shellCheck = findShellCheck();

  it.skipIf(!shellCheck)("passes ShellCheck", () => {
    expect(() => execFileSync(shellCheck ?? "shellcheck", [SCRIPT])).not.toThrow();
  });

  it("plans Docker, Postgres and Caddy with HTTPS by default", () => {
    const result = dryRun("--domain", "cms.example.com", "--email", "ana@example.com");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Dry run: nothing will be changed");
    expect(result.stdout).toContain("would write: /tmp/lintel-dry-run/deploy/.env");
    expect(result.stdout).toContain("--profile https up -d --build");
    expect(result.stdout).toContain("https://cms.example.com/admin");
    // Passwords are written to files, never shown.
    expect(result.stdout).not.toMatch(/POSTGRES_PASSWORD=\S/);
  });

  it("plans Node.js, a systemd service and Caddy with --method node", () => {
    const result = dryRun("--method", "node", "--domain", "cms.example.com", "--email", "a@b.co");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("would write: /etc/systemd/system/lintel.service");
    expect(result.stdout).toContain("would write: /etc/caddy/Caddyfile");
    expect(result.stdout).toContain("systemctl enable --now lintel");
  });

  it("stops with the option to use when there is nobody to answer a question", () => {
    const result = dryRun("--domain", "not a domain", "--yes");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("pass --domain");
  });

  it("refuses an unknown method", () => {
    expect(dryRun("--method", "ftp").stderr).toContain("--method should be docker or node");
  });
});
