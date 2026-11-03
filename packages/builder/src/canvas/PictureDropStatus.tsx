import { ImageUp, TriangleAlert, X } from "lucide-react";
import { useBuilderText } from "../i18n/builder-text.js";
import type { PictureDropStatus as Status } from "./usePictureDrop.js";

/**
 * A small note at the foot of the canvas while a dropped or pasted picture uploads, and
 * afterwards whether it worked. Problems stay until dismissed, so there's time to read them.
 * Screen readers hear the same words through the builder's announcements.
 */
export function PictureDropStatus({
  status,
  onDismiss,
}: {
  status: Status | null;
  onDismiss: () => void;
}) {
  const text = useBuilderText();
  if (!status) return null;
  const message =
    status.state === "uploading"
      ? text("pageBuilder.pictureDrop.uploading", { name: status.filename })
      : status.message;
  const Icon = status.state === "failed" ? TriangleAlert : ImageUp;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-4">
      <div
        className={`pointer-events-auto flex max-w-md items-start gap-2 rounded-card bg-surface px-3 py-2 text-footnote shadow-float hairline-ring ${
          status.state === "failed" ? "text-danger" : "text-label"
        }`}
      >
        <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <p className="min-w-0 flex-1">{message}</p>
        {status.state !== "uploading" && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={text("pageBuilder.pictureDrop.dismiss")}
            className="-me-1 flex size-6 shrink-0 items-center justify-center rounded-full text-label-secondary hover:bg-fill focus-visible:focus-ring"
          >
            <X aria-hidden="true" className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
