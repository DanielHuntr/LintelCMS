import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { appManifestSchema } from "@lintel/core/app-manifest";
import { signSessionToken } from "@lintel/core/app-session-tokens";
import { signWebhookBody } from "@lintel/core/webhook-signatures";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCommandLine } from "../command-line.js";
import type { Terminal } from "../terminal.js";
import { scaffoldApp, titleFor } from "./app-scaffold.js";

const run = promisify(execFile);

function recordingTerminal(workingFolder: string) {
  const said: string[] = [];
  const terminal: Terminal = {
    say: (line = "") => said.push(line),
    warn: (line) => said.push(`! ${line}`),
    ask: async () => "",
    workingFolder,
  };
  return { terminal, said };
}

/** Everything in a folder, as relative paths. */
async function filesIn(folder: string, within = ""): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(join(folder, within), { withFileTypes: true })) {
    const path = within ? `${within}/${entry.name}` : entry.name;
    found.push(...(entry.isDirectory() ? await filesIn(folder, path) : [path]));
  }
  return found.sort();
}

let folder: string;

beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), "lintel-cli-apps-"));
});

afterEach(async () => {
  await rm(folder, { recursive: true, force: true });
});

describe("lintel apps new", () => {
  it("makes a whole app with its name filled in everywhere", async () => {
    const { terminal, said } = recordingTerminal(folder);

    expect(await runCommandLine(["apps", "new", "stock-sync"], terminal)).toBe(0);

    const app = join(folder, "stock-sync");
    expect(await filesIn(app)).toEqual([
      ".env.example",
      ".gitignore",
      "README.md",
      "package.json",
      "public/page.js",
      "public/style.css",
      "src/config.js",
      "src/main.js",
      "src/manifest.js",
      "src/server.js",
      "src/session-tokens.js",
      "src/webhook-signatures.js",
      "test/app-checks.js",
    ]);
    for (const file of await filesIn(app)) {
      expect(await readFile(join(app, file), "utf8"), file).not.toMatch(/__[A-Z_]+__/);
    }
    const packageFile = JSON.parse(await readFile(join(app, "package.json"), "utf8"));
    expect(packageFile.name).toBe("stock-sync");
    expect(packageFile.dependencies["@lintel/app-bridge"]).toMatch(
      /^file:.*\/packages\/app-bridge$/,
    );
    expect(said.join("\n")).toContain("Build → Apps, turn on Development mode");
  });

  it("writes a manifest Lintel accepts", async () => {
    const app = await scaffoldApp({
      name: "stock-sync",
      terminal: recordingTerminal(folder).terminal,
    });
    const { readConfig } = await import(pathToFileURL(join(app, "src", "config.js")).href);
    const { appManifest } = await import(pathToFileURL(join(app, "src", "manifest.js")).href);

    const manifest = appManifestSchema.parse(appManifest(readConfig({})));

    expect(manifest).toMatchObject({
      name: "Stock sync",
      handle: "stock-sync",
      appUrl: "http://localhost:3200",
      scopes: ["read_content"],
      admin: { page: { label: "Stock sync", url: "http://localhost:3200/admin/page" } },
    });
  });

  it("checks session tokens and webhooks the way Lintel signs them", async () => {
    const app = await scaffoldApp({
      name: "stock-sync",
      terminal: recordingTerminal(folder).terminal,
    });
    const { verifySessionToken } = await import(
      pathToFileURL(join(app, "src", "session-tokens.js")).href
    );
    const { verifyWebhook } = await import(
      pathToFileURL(join(app, "src", "webhook-signatures.js")).href
    );
    const clientId = "app_0123456789abcdef0123";
    const clientSecret = "lintelapp_a-secret-for-these-tests-only";
    const { token } = signSessionToken(clientSecret, {
      iss: "http://localhost:4000",
      dest: "http://localhost:5173",
      aud: clientId,
      sub: "a7f0c9c4-3d0b-4c43-a4a1-6b6f6c0f3b11",
      appId: "f2b4a4f6-1e8f-4a39-9a7c-0b4b8f5b0c22",
      permissions: ["entries:read"],
    });
    const body = JSON.stringify({ event: "entry.published" });

    expect(verifySessionToken(token, { clientId, clientSecret })).toMatchObject({
      permissions: ["entries:read"],
    });
    expect(verifySessionToken(token, { clientId: "app_other", clientSecret })).toBeUndefined();
    expect(verifyWebhook(body, signWebhookBody(clientSecret, body, new Date()), clientSecret)).toBe(
      true,
    );
    expect(
      verifyWebhook(body, signWebhookBody("lintelapp_other", body, new Date()), clientSecret),
    ).toBe(false);
  });

  it("passes its own tests straight away", async () => {
    const app = await scaffoldApp({
      name: "stock-sync",
      terminal: recordingTerminal(folder).terminal,
    });

    const result = await run(process.execPath, ["--test", join("test", "app-checks.js")], {
      cwd: app,
    });

    expect(result.stdout).toMatch(/fail 0/);
    expect(result.stdout, result.stdout).toMatch(/pass 8/);
  }, 60_000);

  it("refuses a name Lintel wouldn't accept, and a folder that isn't empty", async () => {
    const { terminal } = recordingTerminal(folder);
    await expect(scaffoldApp({ name: "Stock Sync!", terminal })).rejects.toThrow(
      /lowercase letters, numbers and dashes/,
    );
    await writeFile(join(folder, "notes.txt"), "mine");
    await expect(scaffoldApp({ name: "stock-sync", folder, terminal })).rejects.toThrow(
      /already has files in it/,
    );
    expect(existsSync(join(folder, "package.json"))).toBe(false);
  });

  it("says how to use it when the subcommand or name is missing", async () => {
    const { terminal, said } = recordingTerminal(folder);
    expect(await runCommandLine(["apps"], terminal)).toBe(1);
    expect(said.join("\n")).toContain("lintel apps <command>");
    expect(titleFor("stock-sync")).toBe("Stock sync");
  });
});
