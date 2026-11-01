import { apiRequest, apiUrl } from "../api/client.js";

/** Calls to the API's publishing routes (see packages/core/src/publishing). */

export const publishTargetKinds = ["ftp", "sftp", "zip", "s3", "folder"] as const;
export type PublishTargetKind = (typeof publishTargetKinds)[number];
export type FormDelivery = "bridge" | "api" | "none";

export interface PublishTargetOptions {
  host?: string;
  port?: number;
  username?: string;
  remoteFolder?: string;
  privateFolder?: string;
  ftpSecurity?: "explicit" | "implicit" | "none";
  bucket?: string;
  region?: string;
  endpoint?: string;
  prefix?: string;
  folderPath?: string;
  siteAddress?: string;
}

export interface PublishTargetSecrets {
  password?: string;
  privateKey?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  stripeWebhookSecret?: string;
}

export interface PublishTarget {
  id: string;
  name: string;
  kind: PublishTargetKind;
  options: PublishTargetOptions;
  formDelivery: FormDelivery;
  publishAutomatically: boolean;
  deleteLimit: number;
  lastPublishedAt: string | null;
  saved: Record<
    "password" | "privateKey" | "accessKeyId" | "secretAccessKey" | "stripeWebhookSecret",
    boolean
  >;
  warnings: string[];
}

export interface PublishTargetInput {
  name: string;
  kind: PublishTargetKind;
  options: PublishTargetOptions;
  secrets: PublishTargetSecrets;
  formDelivery: FormDelivery;
  publishAutomatically: boolean;
}

export type PublishRunStatus = "running" | "succeeded" | "failed" | "needsConfirmation";

export interface PublishRun {
  id: string;
  trigger: "manual" | "automatic" | "command";
  status: PublishRunStatus;
  dryRun: boolean;
  summary: {
    pagesRebuilt: number;
    pagesUnchanged: number;
    uploaded: string[];
    deleted: string[];
    uploadedCount: number;
    deletedCount: number;
    deletionsWaiting: number;
    warnings: string[];
    formsPulled: number;
    ordersPulled: number;
  } | null;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
  progress?: {
    step: "preparing" | "building" | "uploading" | "finishing";
    done: number;
    total: number;
  } | null;
}

const targetPath = (targetId: string) => `/publishing/targets/${encodeURIComponent(targetId)}`;

export async function listPublishTargets(): Promise<PublishTarget[]> {
  const { targets } = await apiRequest<{ targets: PublishTarget[] }>("/publishing/targets");
  return targets;
}

export function createPublishTarget(input: PublishTargetInput) {
  return apiRequest<PublishTarget>("/publishing/targets", { method: "POST", body: input });
}

export function updatePublishTarget(targetId: string, changes: Partial<PublishTargetInput>) {
  return apiRequest<PublishTarget>(targetPath(targetId), { method: "PATCH", body: changes });
}

export function deletePublishTarget(targetId: string) {
  return apiRequest<void>(targetPath(targetId), { method: "DELETE" });
}

export function testPublishTarget(targetId: string) {
  return apiRequest<{ ok: true; message: string }>(`${targetPath(targetId)}/test`, {
    method: "POST",
  });
}

export function publishWebsite(targetId: string, options: { confirmDeletions?: boolean } = {}) {
  return apiRequest<PublishRun>(`${targetPath(targetId)}/publish`, {
    method: "POST",
    body: options,
  });
}

export async function listPublishRuns(targetId: string): Promise<PublishRun[]> {
  const { runs } = await apiRequest<{ runs: PublishRun[] }>(`${targetPath(targetId)}/runs`);
  return runs;
}

export function getPublishRun(targetId: string, runId: string) {
  return apiRequest<PublishRun>(`${targetPath(targetId)}/runs/${encodeURIComponent(runId)}`);
}

/** The ZIP is a plain download: the browser sends the session cookie with it. */
export function zipDownloadUrl(targetId: string): string {
  return `${apiUrl}${targetPath(targetId)}/download`;
}
