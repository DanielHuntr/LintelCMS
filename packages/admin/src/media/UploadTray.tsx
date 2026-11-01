import { X } from "lucide-react";
import { t } from "../i18n/strings.js";
import { UploadProgressList } from "./UploadProgressList.js";
import type { UploadItem } from "./useUploadQueue.js";

interface UploadTrayProps {
  items: readonly UploadItem[];
  onDismiss: (key: string) => void;
  onClose: () => void;
}

/**
 * Floats in the corner while files upload, like the downloads list in a browser, so people
 * can keep browsing the library. It stays until closed, so problems aren't missed.
 */
export function UploadTray({ items, onDismiss, onClose }: UploadTrayProps) {
  if (items.length === 0) return null;

  const uploading = items.filter((item) => item.status === "uploading").length;
  const title =
    uploading === 0
      ? t("media.uploads.finished")
      : uploading === 1
        ? t("media.uploads.uploading.one")
        : t("media.uploads.uploading.other", { count: uploading });

  return (
    <section
      aria-label={t("media.uploads.label")}
      className="fixed right-6 bottom-6 z-30 flex max-h-[min(420px,60vh)] w-[340px] flex-col rounded-panel bg-surface-raised shadow-float hairline-ring transition duration-200 ease-standard starting:translate-y-2 starting:opacity-0"
    >
      <header className="flex items-center justify-between gap-3 px-4 pt-3 pb-1">
        <h2 className="text-footnote font-semibold text-label" aria-live="polite">
          {title}
        </h2>
        {uploading === 0 && (
          <button
            type="button"
            aria-label={t("media.uploads.close")}
            onClick={onClose}
            className="-mr-1.5 flex size-7 items-center justify-center rounded-full text-label-secondary transition-colors duration-150 hover:bg-fill hover:text-label focus-visible:focus-ring"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        )}
      </header>
      <div className="overflow-y-auto px-4 pb-1.5" aria-live="polite">
        <UploadProgressList items={items} onDismiss={onDismiss} />
      </div>
    </section>
  );
}
