#!/usr/bin/env node
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import type { FastifyInstance } from "fastify";
import { loadConfig, loadProjectEnvFile } from "../config.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { createConfiguredStorage } from "../media/configured-storage.js";
import { startPublish } from "../publishing/publish-runs.service.js";
import { listTargetRows } from "../publishing/publishing.repository.js";
import { buildServer } from "../server.js";
import { exportStaticSite } from "../static-site/static-export.service.js";
import { lintelPaths, openConfiguredDatabase, runWithFriendlyErrors } from "../startup.js";
import { fail } from "./read-new-password.js";

/**
 * Lintel's command line, for publishing from a terminal or a scheduled task:
 *
 *   pnpm lintel publish [--target "<name>"] [--dry-run] [--confirm-deletions]
 *   pnpm lintel export --out ./site
 *
 * `publish` publishes to every destination in Settings → Publishing (or just the one
 * named) and says what changed. `export` writes the website as files into a folder.
 */
const USAGE = [
  "Usage:",
  '  lintel publish [--target "<name>"] [--dry-run] [--confirm-deletions]',
  "  lintel export --out <folder>",
].join("\n");

await runWithFriendlyErrors(async () => {
  loadProjectEnvFile();
  const [command, ...rest] = process.argv.slice(2).filter((argument) => argument !== "--");
  const { values } = parseArgs({
    args: rest,
    options: {
      target: { type: "string" },
      "dry-run": { type: "boolean", default: false },
      "confirm-deletions": { type: "boolean", default: false },
      out: { type: "string" },
    },
  });
  if (command !== "publish" && command !== "export") {
    fail(USAGE);
  }
  const server = await openServer();
  try {
    if (command === "export") {
      if (!values.out) fail(`Where should the files go?\n\n${USAGE}`);
      const folder = resolve(values.out);
      const result = await exportStaticSite({ api: server, folder });
      say(
        `Exported the website to ${folder}: ${result.rebuilt.length} pages drawn, ${result.unchanged.length} unchanged.`,
      );
      result.warnings.forEach((warning) => say(`Note: ${warning}`));
      return;
    }
    await publish(
      server,
      values.target,
      values["dry-run"] ?? false,
      values["confirm-deletions"] ?? false,
    );
  } finally {
    await server.close();
  }
});

async function publish(
  server: FastifyInstance,
  targetName: string | undefined,
  dryRun: boolean,
  confirmDeletions: boolean,
): Promise<void> {
  const targets = (await listTargetRows(server.database, DEFAULT_TENANT_ID)).filter(
    (target) => target.kind !== "zip" && (!targetName || target.name === targetName),
  );
  if (targets.length === 0) {
    fail(
      targetName
        ? `There's no destination called "${targetName}". Add it in Settings → Publishing.`
        : "There's nowhere to publish to yet. Add a destination in Settings → Publishing.",
    );
  }
  let failed = false;
  for (const target of targets) {
    const started = await startPublish(server.publishing, target.id, {
      trigger: "command",
      dryRun,
      confirmDeletions,
    });
    const run = await started.finished;
    const summary = run.summary;
    if (run.status === "failed") {
      failed = true;
      say(`${target.name}: failed. ${run.errorMessage ?? ""}`);
      continue;
    }
    say(
      `${target.name}: ${dryRun ? "would upload" : "uploaded"} ${summary?.uploadedCount ?? 0} files and ${dryRun ? "delete" : "deleted"} ${summary?.deletedCount ?? 0}` +
        ` (${summary?.pagesRebuilt ?? 0} pages drawn again, ${summary?.pagesUnchanged ?? 0} unchanged).`,
    );
    summary?.warnings.forEach((warning) => say(`  Note: ${warning}`));
    if (run.status === "needsConfirmation") {
      say("  Run again with --confirm-deletions to delete those files.");
    }
  }
  if (failed) process.exitCode = 1;
}

/** The API server, without listening: the same database, media and website as `pnpm start`. */
async function openServer(): Promise<FastifyInstance> {
  const config = loadConfig();
  const paths = lintelPaths(config);
  const database = await openConfiguredDatabase(config);
  const siteUrl =
    config.SITE_PUBLIC_URL?.replace(/\/+$/, "") ?? `http://localhost:${config.SITE_PORT}`;
  const server = buildServer({
    adminOrigin: config.ADMIN_ORIGIN,
    database,
    lintelFolder: paths.lintelFolder,
    publicApiUrl: config.API_PUBLIC_URL ?? `http://localhost:${config.API_PORT}`,
    runScheduledJobs: false,
    website: { builtInSiteUrl: siteUrl },
    media: {
      storage: createConfiguredStorage(config, paths.uploadsFolder),
      transformCacheFolder: paths.transformCacheFolder,
    },
  });
  server.addHook("onClose", () => database.close());
  await server.ready();
  return server;
}

function say(message: string): void {
  process.stdout.write(`${message}\n`);
}
