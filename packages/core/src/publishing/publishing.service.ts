import { randomBytes } from "node:crypto";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import type { SecretBox } from "../secrets/secret-box.js";
import { findSiteById } from "../sites/sites.repository.js";
import { findOrCreateDefaultSite } from "../sites/sites.service.js";
import type { Site } from "../sites/sites.table.js";
import {
  describeConnectionError,
  PublishConnectionError,
  PublishSiteNotFoundError,
  PublishTargetNotFoundError,
} from "./publishing.errors.js";
import {
  deleteTargetRow,
  findTargetRow,
  insertTargetRow,
  listRunRows,
  listTargetRows,
  updateTargetRow,
} from "./publishing.repository.js";
import type {
  CreatePublishTargetRequest,
  PublishTargetSecrets,
  UpdatePublishTargetRequest,
} from "./publishing.schema.js";
import type {
  FormDeliveryMode,
  PublishRunRow,
  PublishTargetKind,
  PublishTargetRow,
} from "./publishing.table.js";
import { openTargetRemote, targetLocation } from "./target-remotes.js";

/** Settings → Publishing: the places a website is published to as files. */

export interface PublishTarget {
  id: string;
  name: string;
  /** The site published here; null for the default site. */
  siteId: string | null;
  kind: PublishTargetKind;
  options: PublishTargetRow["options"];
  formDelivery: FormDeliveryMode;
  publishAutomatically: boolean;
  deleteLimit: number;
  lastPublishedAt: string | null;
  /** Which secrets are saved; what they are is never sent. */
  saved: {
    password: boolean;
    privateKey: boolean;
    accessKeyId: boolean;
    secretAccessKey: boolean;
    stripeWebhookSecret: boolean;
  };
  /** Plain-English warnings about this destination's settings. */
  warnings: string[];
}

export interface PublishingDependencies {
  database: DatabaseOrTransaction;
  secretBox: () => SecretBox;
}

export function readSecrets(
  box: SecretBox,
  row: Pick<PublishTargetRow, "sealedSecrets">,
): PublishTargetSecrets {
  if (!row.sealedSecrets) return {};
  return JSON.parse(box.open(row.sealedSecrets)) as PublishTargetSecrets;
}

function sealSecrets(box: SecretBox, secrets: PublishTargetSecrets): string {
  return box.seal(JSON.stringify(secrets));
}

/** Typed secrets replace saved ones; an empty string forgets one; left out keeps it. */
function mergeSecrets(
  saved: PublishTargetSecrets,
  typed: Partial<PublishTargetSecrets>,
): PublishTargetSecrets {
  const merged: PublishTargetSecrets = { ...saved };
  for (const [key, value] of Object.entries(typed) as Array<
    [keyof PublishTargetSecrets, string | undefined]
  >) {
    if (value === undefined) continue;
    if (value === "") delete merged[key];
    else merged[key] = value;
  }
  return merged;
}

export function describeTarget(box: SecretBox, row: PublishTargetRow): PublishTarget {
  let secrets: PublishTargetSecrets = {};
  const warnings: string[] = [];
  try {
    secrets = readSecrets(box, row);
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : String(error));
  }
  if (row.kind === "ftp" && row.options.ftpSecurity === "none") {
    warnings.push(
      "Plain FTP sends your password and files unencrypted. Choose FTPS if your host offers it (most do).",
    );
  }
  if (row.kind === "s3" && row.formDelivery === "bridge") {
    warnings.push(
      "Buckets can't run PHP, so forms on this site post to Lintel's own address instead.",
    );
  }
  return {
    id: row.id,
    name: row.name,
    siteId: row.siteId,
    kind: row.kind,
    options: row.options,
    formDelivery: row.kind === "s3" && row.formDelivery === "bridge" ? "api" : row.formDelivery,
    publishAutomatically: row.publishAutomatically,
    deleteLimit: row.deleteLimit,
    lastPublishedAt: row.lastPublishedAt?.toISOString() ?? null,
    saved: {
      password: Boolean(secrets.password),
      privateKey: Boolean(secrets.privateKey),
      accessKeyId: Boolean(secrets.accessKeyId),
      secretAccessKey: Boolean(secrets.secretAccessKey),
      stripeWebhookSecret: Boolean(secrets.stripeWebhookSecret),
    },
    warnings,
  };
}

export async function listPublishTargets(dependencies: PublishingDependencies) {
  const rows = await listTargetRows(dependencies.database, DEFAULT_TENANT_ID);
  return { targets: rows.map((row) => describeTarget(dependencies.secretBox(), row)) };
}

export async function findPublishTargetRow(
  database: DatabaseOrTransaction,
  targetId: string,
): Promise<PublishTargetRow> {
  const row = await findTargetRow(database, DEFAULT_TENANT_ID, targetId);
  if (!row) throw new PublishTargetNotFoundError();
  return row;
}

/** Sensible defaults by kind: FTPS on 21, SFTP on 22, the companion outside the website. */
function defaultOptions(request: CreatePublishTargetRequest): PublishTargetRow["options"] {
  const options = { ...request.options };
  if (request.kind === "ftp") {
    options.ftpSecurity ??= "explicit";
    options.port ??= options.ftpSecurity === "implicit" ? 990 : 21;
  }
  if (request.kind === "sftp") options.port ??= 22;
  if (request.kind === "ftp" || request.kind === "sftp" || request.kind === "folder") {
    options.remoteFolder ??= request.kind === "folder" ? "" : "public_html";
    options.privateFolder ??= "../lintel-private";
  }
  return options;
}

/** The site a destination publishes: its own, or the default site. */
export async function siteForTarget(
  database: DatabaseOrTransaction,
  target: Pick<PublishTargetRow, "siteId">,
): Promise<Site> {
  const site = target.siteId ? await findSiteById(database, target.siteId) : undefined;
  return site ?? findOrCreateDefaultSite(database);
}

async function checkSiteExists(database: DatabaseOrTransaction, siteId: string | null | undefined) {
  if (siteId && !(await findSiteById(database, siteId))) throw new PublishSiteNotFoundError();
}

export async function createPublishTarget(
  dependencies: PublishingDependencies,
  request: CreatePublishTargetRequest,
): Promise<PublishTarget> {
  const box = dependencies.secretBox();
  await checkSiteExists(dependencies.database, request.siteId);
  const secrets = mergeSecrets({ bridgeSecret: randomBytes(32).toString("hex") }, request.secrets);
  const row = await insertTargetRow(dependencies.database, {
    tenantId: DEFAULT_TENANT_ID,
    name: request.name,
    siteId: request.siteId ?? null,
    kind: request.kind,
    options: defaultOptions(request),
    sealedSecrets: sealSecrets(box, secrets),
    formDelivery: request.formDelivery ?? (request.kind === "s3" ? "api" : "bridge"),
    publishAutomatically: request.publishAutomatically,
    deleteLimit: request.deleteLimit,
  });
  return describeTarget(box, row);
}

export async function updatePublishTarget(
  dependencies: PublishingDependencies,
  targetId: string,
  changes: UpdatePublishTargetRequest,
): Promise<PublishTarget> {
  const box = dependencies.secretBox();
  const row = await findPublishTargetRow(dependencies.database, targetId);
  await checkSiteExists(dependencies.database, changes.siteId);
  let sealedSecrets = row.sealedSecrets;
  if (changes.secrets) {
    let saved: PublishTargetSecrets = {};
    try {
      saved = readSecrets(box, row);
    } catch {
      // Unreadable (the secret key changed): start again from what was typed.
    }
    sealedSecrets = sealSecrets(box, mergeSecrets(saved, changes.secrets));
  }
  const updated = await updateTargetRow(dependencies.database, row.id, {
    ...(changes.name !== undefined && { name: changes.name }),
    ...(changes.siteId !== undefined && { siteId: changes.siteId }),
    ...(changes.options !== undefined && { options: { ...row.options, ...changes.options } }),
    ...(changes.formDelivery !== undefined && { formDelivery: changes.formDelivery }),
    ...(changes.publishAutomatically !== undefined && {
      publishAutomatically: changes.publishAutomatically,
    }),
    ...(changes.deleteLimit !== undefined && { deleteLimit: changes.deleteLimit }),
    sealedSecrets,
  });
  if (!updated) throw new PublishTargetNotFoundError();
  return describeTarget(box, updated);
}

export async function deletePublishTarget(
  dependencies: PublishingDependencies,
  targetId: string,
): Promise<void> {
  if (!(await deleteTargetRow(dependencies.database, DEFAULT_TENANT_ID, targetId))) {
    throw new PublishTargetNotFoundError();
  }
}

/**
 * "Test connection": connects, writes a small file, reads it back and deletes it, so a
 * wrong password or a read-only folder shows up now rather than on the first publish.
 */
export async function testPublishTarget(
  dependencies: PublishingDependencies,
  targetId: string,
): Promise<{ ok: true; message: string }> {
  const row = await findPublishTargetRow(dependencies.database, targetId);
  if (row.kind === "zip") {
    return {
      ok: true,
      message: "Nothing to connect to: this destination makes a ZIP to download.",
    };
  }
  const where = targetLocation(row);
  try {
    const remote = await openTargetRemote(row, readSecrets(dependencies.secretBox(), row));
    try {
      const probe = `.lintel-connection-test-${randomBytes(4).toString("hex")}.txt`;
      await remote.writeFile(probe, Buffer.from("Lintel checked it can publish here.\n"));
      const readBack = await remote.readFile(probe);
      await remote.deleteFile(probe);
      if (!readBack) throw new Error("The test file couldn't be read back.");
    } finally {
      await remote.close();
    }
  } catch (error) {
    if (error instanceof PublishConnectionError) throw error;
    throw new PublishConnectionError(describeConnectionError(error, where));
  }
  return { ok: true, message: `Lintel connected to ${where} and could write files there.` };
}

export async function listPublishRuns(database: DatabaseOrTransaction, targetId: string) {
  await findPublishTargetRow(database, targetId);
  const runs = await listRunRows(database, DEFAULT_TENANT_ID, targetId, 30);
  return { runs: runs.map(describeRun) };
}

export function describeRun(run: PublishRunRow) {
  return {
    id: run.id,
    trigger: run.trigger,
    status: run.status,
    dryRun: run.dryRun,
    summary: run.summary,
    errorMessage: run.errorMessage,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
  };
}
