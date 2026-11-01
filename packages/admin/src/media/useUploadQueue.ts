import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../api/client.js";
import { t } from "../i18n/strings.js";
import { type Asset, uploadAsset } from "./media.api.js";
import { findUploadProblem } from "./upload-rules.js";

export interface UploadItem {
  /** Local only, for React keys and dismissing. */
  key: string;
  name: string;
  status: "uploading" | "done" | "failed";
  /** 0 to 1. */
  progress: number;
  error?: string;
  asset?: Asset;
}

interface UploadQueueOptions {
  /** Called once per file that uploads successfully. */
  onUploaded?: (asset: Asset) => void;
  imagesOnly?: boolean;
  /** Swapped in tests; the real one sends the file to the API. */
  upload?: typeof uploadAsset;
}

/**
 * Uploads files side by side and tracks each one, so a page can show progress, results and
 * problems per file. Files that break the rules are listed straight away as failed, with
 * the reason, and never sent.
 */
export function useUploadQueue({
  onUploaded,
  imagesOnly = false,
  upload = uploadAsset,
}: UploadQueueOptions = {}) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const nextKey = useRef(0);
  // Kept in a ref so a new callback from the parent doesn't restart running uploads.
  const onUploadedRef = useRef(onUploaded);
  useEffect(() => {
    onUploadedRef.current = onUploaded;
  });

  const updateItem = useCallback((key: string, changes: Partial<UploadItem>) => {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...changes } : item)),
    );
  }, []);

  const addFiles = useCallback(
    (files: readonly File[]) => {
      const added = files.map((file) => {
        nextKey.current += 1;
        const problem = findUploadProblem(file, { imagesOnly });
        const item: UploadItem = {
          key: `upload-${nextKey.current}`,
          name: file.name,
          status: problem ? "failed" : "uploading",
          progress: 0,
          error: problem,
        };
        return { file, item };
      });
      setItems((current) => [...added.map(({ item }) => item), ...current]);

      for (const { file, item } of added) {
        if (item.status === "failed") continue;
        upload(file, (progress) => updateItem(item.key, { progress }))
          .then((asset) => {
            updateItem(item.key, { status: "done", progress: 1, asset });
            onUploadedRef.current?.(asset);
          })
          .catch((error: unknown) =>
            updateItem(item.key, { status: "failed", error: describeUploadError(error) }),
          );
      }
    },
    [imagesOnly, updateItem, upload],
  );

  const dismiss = useCallback((key: string) => {
    setItems((current) => current.filter((item) => item.key !== key));
  }, []);

  /** Clears everything that has finished; uploads still running stay. */
  const clearFinished = useCallback(() => {
    setItems((current) => current.filter((item) => item.status === "uploading"));
  }, []);

  return { items, addFiles, dismiss, clearFinished };
}

function describeUploadError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return t("media.upload.unreachable");
}
