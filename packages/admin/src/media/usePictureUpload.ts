import { useCallback, useRef, useState } from "react";
import { t } from "../i18n/strings.js";
import { type Asset, uploadAsset } from "./media.api.js";
import { findUploadProblem } from "./upload-rules.js";
import { describeUploadError } from "./useUploadQueue.js";

export type PictureUploadState =
  | { state: "idle" }
  | { state: "uploading"; name: string; progress: number }
  | { state: "failed"; message: string }
  | { state: "done"; message: string };

/**
 * One picture dropped or pasted straight into a field: checked with the library's own rules,
 * uploaded with progress, then handed back. The state says what is happening in plain words,
 * for `PictureUploadStatus`. Only the first picture is used; a field holds one.
 */
export function usePictureUpload({
  upload = uploadAsset,
}: {
  /** Swapped in tests; the real one sends the file to the API. */
  upload?: typeof uploadAsset;
} = {}) {
  const [status, setStatus] = useState<PictureUploadState>({ state: "idle" });
  const running = useRef(false);

  const uploadPicture = useCallback(
    async (files: readonly File[], doneMessage: string): Promise<Asset | undefined> => {
      const file = files[0];
      if (!file || running.current) return undefined;
      const problem = findUploadProblem(file, { imagesOnly: true });
      if (problem) {
        const isPicture = file.type.startsWith("image/");
        setStatus({
          state: "failed",
          message: isPicture ? problem : t("media.quickUpload.notPicture", { name: file.name }),
        });
        return undefined;
      }
      running.current = true;
      setStatus({ state: "uploading", name: file.name, progress: 0 });
      try {
        const asset = await upload(file, (progress) =>
          setStatus({ state: "uploading", name: file.name, progress }),
        );
        setStatus({ state: "done", message: doneMessage });
        return asset;
      } catch (error) {
        setStatus({
          state: "failed",
          message: t("media.quickUpload.failed", {
            name: file.name,
            reason: describeUploadError(error),
          }),
        });
        return undefined;
      } finally {
        running.current = false;
      }
    },
    [upload],
  );

  const showProblem = useCallback((message: string) => {
    setStatus({ state: "failed", message });
  }, []);
  const clear = useCallback(() => setStatus({ state: "idle" }), []);

  return { status, uploadPicture, showProblem, clear };
}
