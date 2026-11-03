import type { DraftPageRequest, DraftWatch, PageDrafting, RewriteStyle } from "@lintel/builder";
import type { DraftPlan } from "@lintel/builder-model";
import { ApiError, apiRequest } from "../api/client.js";

/** The writing model and this server's room for it (see packages/core/src/page-drafts). */
export interface ModelStatus {
  state: "not-installed" | "paused" | "downloading" | "checking" | "installed" | "failed";
  model: {
    name: string;
    maker: string;
    licence: string;
    licenceUrl: string;
    sourcePage: string;
    files: Array<{ name: string; url: string; sizeInBytes: number; sha256: string }>;
    sizeInBytes: number;
    memoryNeededInBytes: number;
  };
  folder: string;
  bytesOnDisk: number;
  problem: string | null;
  server: {
    totalMemoryInBytes: number;
    freeDiskInBytes: number;
    hasEnoughMemory: boolean;
    hasEnoughDisk: boolean;
  };
}

export const readModelStatus = () => apiRequest<ModelStatus>("/drafts/model");
export const startModelDownload = () =>
  apiRequest<ModelStatus>("/drafts/model/download", { method: "POST" });
export const cancelModelDownload = () =>
  apiRequest<ModelStatus>("/drafts/model/download/cancel", { method: "POST" });
export const checkCopiedModel = () =>
  apiRequest<ModelStatus>("/drafts/model/check", { method: "POST" });
export const removeModel = () => apiRequest<ModelStatus>("/drafts/model", { method: "DELETE" });
export const readDraftingStatus = () =>
  apiRequest<{ ready: boolean; busy: boolean }>("/drafts/status");

interface DraftJob<Result> {
  id: string;
  state: "writing" | "done" | "failed" | "stopped";
  characters: number;
  expectedCharacters: number;
  result: Result | null;
  problem: string | null;
}

const POLL_EVERY_MS = 1000;

/**
 * Starts a draft on the server, then asks how it's going every second until it's done.
 * Aborting the watch's signal stops it on the server too.
 */
async function followDraft<Result>(
  start: () => Promise<DraftJob<Result>>,
  watch: DraftWatch,
): Promise<Result> {
  let job = await start();
  const stop = () => void apiRequest(`/drafts/jobs/${job.id}/stop`, { method: "POST" });
  watch.signal.addEventListener("abort", stop, { once: true });
  try {
    while (job.state === "writing") {
      watch.onProgress(Math.min(0.97, job.characters / Math.max(1, job.expectedCharacters)));
      await new Promise((resolve) => setTimeout(resolve, POLL_EVERY_MS));
      if (watch.signal.aborted) throw new Error("Stopped");
      job = await apiRequest<DraftJob<Result>>(`/drafts/jobs/${job.id}`);
    }
  } finally {
    watch.signal.removeEventListener("abort", stop);
  }
  if (job.state !== "done" || !job.result) throw new Error(job.problem ?? "Stopped");
  watch.onProgress(1);
  return job.result;
}

/** What the builder needs for "Draft a page for me" and "Rewrite this". */
export function pageDraftingTools(isReady: boolean): PageDrafting {
  return {
    isReady,
    draftPage: async (request: DraftPageRequest, watch: DraftWatch) =>
      (
        await followDraft<{ plan: DraftPlan }>(
          () => apiRequest("/drafts/page", { method: "POST", body: request }),
          watch,
        ).catch(rethrowReadably)
      ).plan,
    rewrite: async (request: { text: string; style: RewriteStyle }, watch: DraftWatch) =>
      (
        await followDraft<{ text: string }>(
          () => apiRequest("/drafts/rewrite", { method: "POST", body: request }),
          watch,
        ).catch(rethrowReadably)
      ).text,
  };
}

/** The server explains drafting's problems itself ("Someone is drafting right now"). */
function rethrowReadably(error: unknown): never {
  if (error instanceof ApiError && error.message) throw new Error(error.message);
  throw error;
}
