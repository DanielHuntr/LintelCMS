import { AlertTriangle } from "lucide-react";
import { t } from "../i18n/strings.js";
import { useImageResizingStatus } from "./media.queries.js";

/**
 * Shown in the media library when the server can't resize images (sharp couldn't load,
 * usually on shared hosting), so editors know why large photos load slowly.
 */
export function ImageResizingNotice() {
  const status = useImageResizingStatus().data;
  if (status?.available !== false) {
    return null;
  }
  return (
    <section
      role="status"
      aria-labelledby="image-resizing-notice"
      className="mb-6 rounded-card bg-surface p-4"
    >
      <h2 id="image-resizing-notice" className="flex items-center gap-2 text-headline text-warning">
        <AlertTriangle aria-hidden="true" className="size-4" />
        {t("media.noResizing.title")}
      </h2>
      <p className="mt-1 text-body text-label-secondary">{t("media.noResizing.description")}</p>
      {status.problem && (
        <p className="mt-2 text-footnote text-label-secondary">
          {t("media.noResizing.fix")} <code className="font-mono">{status.problem}</code>
        </p>
      )}
    </section>
  );
}
