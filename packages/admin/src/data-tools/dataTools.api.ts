import { apiErrorFromBody, apiRequest, apiUrl } from "../api/client.js";

/**
 * Calls to the API's backup, export and import routes (see packages/core/src/backups,
 * src/content-transfer and src/wordpress-import).
 */

export type BackupTrigger = "manual" | "scheduled" | "before-restore" | "uploaded";
export type BackupStatus = "running" | "complete" | "failed";
export type BackupFrequency = "off" | "daily" | "weekly";

export interface Backup {
  id: string;
  filename: string;
  trigger: BackupTrigger;
  status: BackupStatus;
  size: number | null;
  contents: { tables: Record<string, number>; mediaFiles: number } | null;
  failureReason: string | null;
  createdByName: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface BackupSchedule {
  frequency: BackupFrequency;
  keep: number;
}

export interface RestoreSummary {
  createdAt: string;
  tables: Array<{ table: string; inBackup: number; current: number }>;
  mediaFiles: number;
}

export function listBackups() {
  return apiRequest<{ backups: Backup[]; schedule: BackupSchedule }>("/backups");
}

export function createBackup() {
  return apiRequest<Backup>("/backups", { method: "POST" });
}

export function deleteBackup(backupId: string) {
  return apiRequest<void>(`/backups/${encodeURIComponent(backupId)}`, { method: "DELETE" });
}

export function saveBackupSchedule(schedule: BackupSchedule) {
  return apiRequest<BackupSchedule>("/backups/schedule", { method: "PUT", body: schedule });
}

export function previewRestore(backupId: string) {
  return apiRequest<RestoreSummary>(`/backups/${encodeURIComponent(backupId)}/restore-preview`);
}

export function restoreBackup(backupId: string) {
  return apiRequest<RestoreSummary>(`/backups/${encodeURIComponent(backupId)}/restore`, {
    method: "POST",
    body: { confirm: "RESTORE" },
  });
}

export function backupDownloadUrl(backupId: string): string {
  return `${apiUrl}/backups/${encodeURIComponent(backupId)}/download`;
}

export function exportDownloadUrl(options: { revisions: boolean; files: boolean }): string {
  const query = new URLSearchParams({
    revisions: String(options.revisions),
    files: String(options.files),
  });
  return `${apiUrl}/content-export?${query}`;
}

export type ImportKind =
  | "blueprint"
  | "collection"
  | "taxonomy"
  | "term"
  | "global"
  | "menu"
  | "media"
  | "entry";
export type ImportAction = "create" | "update" | "skip";
export type ConflictStrategy = "skip" | "overwrite";

export interface ImportPlan {
  strategy: ConflictStrategy;
  totals: Record<ImportKind, Record<ImportAction, number>>;
  items: Array<{ kind: ImportKind; label: string; action: ImportAction }>;
  warnings: string[];
}

export function previewContentImport(uploadId: string, strategy: ConflictStrategy) {
  return apiRequest<ImportPlan>(
    `/content-imports/${encodeURIComponent(uploadId)}/preview?strategy=${strategy}`,
  );
}

export function runContentImport(uploadId: string, strategy: ConflictStrategy) {
  return apiRequest<ImportPlan>(`/content-imports/${encodeURIComponent(uploadId)}`, {
    method: "POST",
    body: { strategy },
  });
}

/**
 * Sends files as a form, reporting progress from 0 to 1. XMLHttpRequest because fetch
 * can't report upload progress; backups and exports can be large.
 */
export function uploadFiles<Result>(
  path: string,
  files: Record<string, File>,
  onProgress: (fraction: number) => void,
): Promise<Result> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${apiUrl}${path}`);
    request.withCredentials = true;
    request.responseType = "json";
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(1);
        resolve(request.response as Result);
      } else {
        reject(apiErrorFromBody(request.status, request.statusText, request.response));
      }
    });
    request.addEventListener("error", () => reject(new TypeError("Failed to fetch")));
    const form = new FormData();
    for (const [field, file] of Object.entries(files)) {
      form.append(field, file);
    }
    request.send(form);
  });
}
