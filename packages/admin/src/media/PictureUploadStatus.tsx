import { X } from "lucide-react";
import { classNames } from "../design/classNames.js";
import { t } from "../i18n/strings.js";
import type { PictureUploadState } from "./usePictureUpload.js";

/**
 * A line under a field while a dropped or pasted picture uploads: its name and how far it
 * has got, then whether it worked. Problems stay until dismissed; screen readers hear each
 * change.
 */
export function PictureUploadStatus({
  status,
  onDismiss,
}: {
  status: PictureUploadState;
  onDismiss: () => void;
}) {
  const percent = status.state === "uploading" ? Math.round(status.progress * 100) : 0;
  return (
    <div role="status">
      {status.state === "uploading" && (
        <div className="flex flex-col gap-1 pt-1">
          <p className="text-footnote text-label-secondary">
            {t("media.quickUpload.uploading", { name: status.name, percent })}
          </p>
          <div className="h-1 overflow-hidden rounded-full bg-fill" aria-hidden="true">
            <div
              className="h-full rounded-full bg-accent-fill transition-[width] duration-150"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}
      {(status.state === "failed" || status.state === "done") && (
        <div className="flex items-start gap-2 pt-1">
          <p
            className={classNames(
              "min-w-0 flex-1 text-footnote",
              status.state === "failed" ? "text-danger" : "text-label-secondary",
            )}
          >
            {status.message}
          </p>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t("media.quickUpload.dismiss")}
            className="-me-1 flex size-6 shrink-0 items-center justify-center rounded-full text-label-secondary hover:bg-fill focus-visible:focus-ring"
          >
            <X aria-hidden="true" className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
