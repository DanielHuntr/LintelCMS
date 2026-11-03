import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { pullFromBridge } from "../bridge/bridge-pull.service.js";
import { prepareBridgePublish } from "../bridge/bridge-publish.service.js";
import { exportStaticSite } from "../static-site/static-export.service.js";
import { hashContent } from "../static-site/static-files.js";
import type { PublishingContext } from "./publishing-context.js";
import {
  describeConnectionError,
  PublishAlreadyRunningError,
  PublishConnectionError,
  PublishRunNotFoundError,
} from "./publishing.errors.js";
import {
  findRunRow,
  insertRunRow,
  updateRunRow,
  updateTargetRow,
} from "./publishing.repository.js";
import {
  describeRun,
  findPublishTargetRow,
  readSecrets,
  siteForTarget,
} from "./publishing.service.js";
import type {
  PublishRunRow,
  PublishRunSummary,
  PublishRunTrigger,
  PublishTargetRow,
} from "./publishing.table.js";
import type { RemoteFolder } from "./remotes/remote-folder.js";
import { openTargetRemote, targetLocation } from "./target-remotes.js";
import {
  planUpload,
  readRemoteManifest,
  REMOTE_MANIFEST_FILE,
  type RemoteManifest,
} from "./upload-plan.js";

/**
 * One publish, start to finish: collect what the website's companion took in, export the
 * site (only what changed is drawn again), upload what differs, delete what Lintel put
 * there before and the site no longer has, and write down what happened.
 */

const LISTED_FILES = 200;

export interface PublishRequest {
  trigger: PublishRunTrigger;
  dryRun?: boolean;
  confirmDeletions?: boolean;
}

export interface StartedPublish {
  run: ReturnType<typeof describeRun>;
  /** Settles when the publish is over, with its final state. */
  finished: Promise<ReturnType<typeof describeRun>>;
}

export async function startPublish(
  context: PublishingContext,
  targetId: string,
  request: PublishRequest,
): Promise<StartedPublish> {
  const target = await findPublishTargetRow(context.database, targetId);
  if (context.running.has(target.id)) throw new PublishAlreadyRunningError();
  const run = await insertRunRow(context.database, {
    tenantId: DEFAULT_TENANT_ID,
    targetId: target.id,
    trigger: request.trigger,
    dryRun: request.dryRun ?? false,
  });
  context.running.set(target.id, {
    runId: run.id,
    progress: { step: "preparing", done: 0, total: 0 },
  });
  const finished = runPublish(context, target, run, request).finally(() =>
    context.running.delete(target.id),
  );
  return { run: describeRun(run), finished };
}

/** A publish's record, with its progress while it runs. */
export async function findPublishRun(context: PublishingContext, targetId: string, runId: string) {
  const run = await findRunRow(context.database, DEFAULT_TENANT_ID, runId);
  if (!run || run.targetId !== targetId) throw new PublishRunNotFoundError();
  const running = context.running.get(targetId);
  return { ...describeRun(run), progress: running?.runId === runId ? running.progress : null };
}

async function runPublish(
  context: PublishingContext,
  target: PublishTargetRow,
  run: PublishRunRow,
  request: PublishRequest,
): Promise<ReturnType<typeof describeRun>> {
  const progress = (step: "building" | "uploading" | "finishing", done: number, total: number) =>
    context.running.set(target.id, { runId: run.id, progress: { step, done, total } });
  const summary: PublishRunSummary = {
    pagesRebuilt: 0,
    pagesUnchanged: 0,
    uploaded: [],
    deleted: [],
    uploadedCount: 0,
    deletedCount: 0,
    deletionsWaiting: 0,
    warnings: [],
    formsPulled: 0,
    ordersPulled: 0,
  };
  try {
    const secrets = readSecrets(context.secretBox(), target);
    const bridge = await prepareBridgePublish(context.api, target, secrets, context.bridgeTesting);
    if (bridge.usesBridge && !request.dryRun && target.lastPublishedAt) {
      try {
        const pulled = await pullFromBridge(context.api, target, secrets.bridgeSecret ?? "");
        summary.formsPulled = pulled.submissions;
        summary.ordersPulled = pulled.orders;
        summary.warnings.push(...pulled.problems);
      } catch (error) {
        summary.warnings.push(error instanceof Error ? error.message : String(error));
      }
    }
    const folder = join(context.exportsFolder, target.id);
    // The catalogue's stock reflects the orders collected just above.
    const fresh =
      summary.ordersPulled > 0
        ? await prepareBridgePublish(context.api, target, secrets, context.bridgeTesting)
        : bridge;
    const exported = await exportStaticSite({
      api: context.api,
      folder,
      site: await siteForTarget(context.database, target),
      formEndpoints: fresh.formEndpoints,
      siteAddress: target.options.siteAddress || null,
      extraFiles: fresh.extraFiles,
      extraPages: fresh.extraPages,
      onProgress: ({ done, total }) => progress("building", done, total),
    });
    summary.pagesRebuilt = exported.rebuilt.length;
    summary.pagesUnchanged = exported.unchanged.length;
    summary.warnings.push(...exported.warnings);

    if (target.kind !== "zip") {
      await upload(
        context,
        target,
        folder,
        exported.files,
        fresh.privateFiles,
        request,
        summary,
        progress,
      );
    }
    const status = summary.deletionsWaiting > 0 ? "needsConfirmation" : "succeeded";
    await finishRun(context, run, status, summary, null);
    if (!request.dryRun) {
      await updateTargetRow(context.database, target.id, { lastPublishedAt: new Date() });
    }
  } catch (error) {
    const message =
      error instanceof PublishConnectionError || !(error instanceof Error)
        ? String(error instanceof Error ? error.message : error)
        : describeConnectionError(error, targetLocation(target));
    await finishRun(context, run, "failed", summary, message);
    context.api.log.error(error, `Publishing to ${target.name} failed`);
  }
  const finished = await findRunRow(context.database, DEFAULT_TENANT_ID, run.id);
  if (!finished) throw new PublishRunNotFoundError();
  return describeRun(finished);
}

async function upload(
  context: PublishingContext,
  target: PublishTargetRow,
  folder: string,
  files: Record<string, string>,
  privateFiles: Array<{ path: string; content: string | Uint8Array }>,
  request: PublishRequest,
  summary: PublishRunSummary,
  progress: (step: "uploading" | "finishing", done: number, total: number) => void,
): Promise<void> {
  const secrets = readSecrets(context.secretBox(), target);
  let remote: RemoteFolder;
  try {
    remote = await openTargetRemote(target, secrets, {
      allowSelfSignedCertificate: context.allowSelfSignedCertificates,
    });
  } catch (error) {
    throw new PublishConnectionError(describeConnectionError(error, targetLocation(target)));
  }
  try {
    const manifest = readRemoteManifest(await remote.readFile(REMOTE_MANIFEST_FILE));
    const plan = planUpload(files, manifest.files, {
      deleteLimit: target.deleteLimit,
      confirmDeletions: request.confirmDeletions ?? false,
    });
    summary.uploaded = plan.upload.slice(0, LISTED_FILES);
    summary.deleted = plan.delete.slice(0, LISTED_FILES);
    summary.uploadedCount = plan.upload.length;
    summary.deletedCount = plan.delete.length;
    summary.deletionsWaiting = plan.deletionsHeld.length;
    if (plan.deletionsHeld.length > 0) {
      summary.warnings.push(
        `${plan.deletionsHeld.length} files would be deleted from the website, more than this destination's limit of ${target.deleteLimit}. Nothing was deleted: check the list and confirm to go ahead.`,
      );
      summary.deleted = plan.deletionsHeld.slice(0, LISTED_FILES);
    }
    if (request.dryRun) return;

    const total = plan.upload.length + plan.delete.length;
    let done = 0;
    for (const file of plan.upload) {
      await remote.writeFile(file, await readFile(join(folder, file)));
      progress("uploading", (done += 1), total);
    }
    for (const file of plan.delete) {
      await remote.deleteFile(file);
      progress("uploading", (done += 1), total);
    }
    progress("finishing", total, total);
    const privateHashes = await uploadPrivateFiles(remote, target, privateFiles, manifest, summary);
    const kept = Object.fromEntries(
      plan.deletionsHeld.map((file) => [file, manifest.files[file] ?? ""]),
    );
    const updated: RemoteManifest = {
      version: 1,
      files: { ...kept, ...files },
      privateFiles: privateHashes,
    };
    await remote.writeFile(REMOTE_MANIFEST_FILE, Buffer.from(`${JSON.stringify(updated)}\n`));
  } finally {
    await remote.close();
  }
}

/**
 * The companion's settings and signed files, into its private folder: outside the website
 * when the account may write there, otherwise a folder inside it that servers are told
 * never to show.
 */
async function uploadPrivateFiles(
  remote: RemoteFolder,
  target: PublishTargetRow,
  files: Array<{ path: string; content: string | Uint8Array }>,
  manifest: RemoteManifest,
  summary: PublishRunSummary,
): Promise<Record<string, string>> {
  if (files.length === 0) return {};
  const preferred = target.options.privateFolder || "../lintel-private";
  const folders = preferred.startsWith("../") ? [preferred, "lintel-private"] : [preferred];
  for (const [index, privateFolder] of folders.entries()) {
    try {
      const hashes: Record<string, string> = {};
      for (const file of files) {
        const path = `${privateFolder}/${file.path}`;
        const hash = hashContent(file.content);
        hashes[path] = hash;
        if (manifest.privateFiles[path] !== hash) {
          await remote.writeFile(path, Buffer.from(file.content));
        }
      }
      if (index > 0) {
        summary.warnings.push(
          "Your hosting didn't let Lintel put the form and shop settings outside the website, so they are in a protected folder inside it (lintel-private). That works, but ask your host whether a folder beside public_html is possible.",
        );
      }
      return hashes;
    } catch (error) {
      if (index === folders.length - 1) throw error;
    }
  }
  return {};
}

async function finishRun(
  context: PublishingContext,
  run: PublishRunRow,
  status: PublishRunRow["status"],
  summary: PublishRunSummary,
  errorMessage: string | null,
): Promise<void> {
  await updateRunRow(context.database, run.id, {
    status,
    summary,
    errorMessage,
    finishedAt: new Date(),
  });
}
