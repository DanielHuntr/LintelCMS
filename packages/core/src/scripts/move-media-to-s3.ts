import { parseArgs } from "node:util";
import { loadConfig, loadProjectEnvFile } from "../config.js";
import { createS3Storage } from "../media/configured-storage.js";
import { LocalDiskStorage } from "../media/local-disk-storage.js";
import { copyStoredFiles } from "../media/storage-move.service.js";
import { lintelPaths, openConfiguredDatabase, runWithFriendlyErrors } from "../startup.js";
import { fail } from "./read-new-password.js";

/**
 * Copies uploaded files from this server's disk to the S3 bucket in the S3_* settings:
 *
 *   pnpm media:move-to-s3 --dry-run   # say what would be copied
 *   pnpm media:move-to-s3             # copy
 *
 * Then set STORAGE_DRIVER=s3 and restart. Files already in the bucket are skipped, so it is
 * safe to run again after an interruption. Nothing is deleted from the disk.
 */
await runWithFriendlyErrors(async () => {
  loadProjectEnvFile();
  const { values } = parseArgs({
    args: process.argv.slice(2).filter((argument) => argument !== "--"),
    options: { "dry-run": { type: "boolean", default: false } },
  });
  const config = loadConfig();
  if (!config.S3_BUCKET) {
    fail(
      "Set S3_BUCKET (and the other S3_ settings) to the bucket the files should go to first.\n" +
        "See the environment variables guide in the docs.",
    );
  }

  const paths = lintelPaths(config);
  const from = new LocalDiskStorage(paths.uploadsFolder);
  const to = createS3Storage(config, config.S3_BUCKET);
  await to.checkReachable();
  const activeDatabase = await openConfiguredDatabase(config);
  const dryRun = values["dry-run"];

  try {
    say(
      `${dryRun ? "Checking" : "Copying"} files from ${paths.uploadsFolder} to "${config.S3_BUCKET}"...`,
    );
    const report = await copyStoredFiles({
      database: activeDatabase.database,
      from,
      to,
      dryRun,
      onFile: (key, outcome) => {
        if (outcome === "copied") say(`  ${dryRun ? "would copy" : "copied"} ${key}`);
      },
    });

    say(
      `\n${report.copied} ${dryRun ? "to copy" : "copied"}, ${report.alreadyThere} already in the bucket.`,
    );
    if (report.missing.length > 0) {
      say(
        `${report.missing.length} file(s) are in the media library but not on this disk, so they were skipped:\n` +
          report.missing.map((key) => `  ${key}`).join("\n"),
      );
    }
    if (!dryRun) {
      say(
        "\nNext: set STORAGE_DRIVER=s3 and restart Lintel. Once the site looks right, you can " +
          `delete ${paths.uploadsFolder}.`,
      );
    }
  } finally {
    to.close();
    await activeDatabase.close();
  }
});

function say(message: string): void {
  process.stdout.write(`${message}\n`);
}
