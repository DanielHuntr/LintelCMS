import { X } from "lucide-react";
import { useEffect } from "react";
import { t } from "../i18n/strings.js";

export interface TreeNotice {
  id: number;
  message: string;
  tone: "neutral" | "danger";
  /** Shown as a button beside the message, such as Undo. */
  action?: { label: string; run: () => void };
}

const VISIBLE_FOR_MS = 8000;

/**
 * A short note at the bottom of the tree after something changed: "Moved “About”. Undo".
 * It is a polite live region, so screen readers hear it without losing their place, and it
 * stays while the pointer or focus is on it.
 */
export function TreeToast({
  notice,
  onDismiss,
}: {
  notice: TreeNotice | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(onDismiss, VISIBLE_FOR_MS);
    return () => clearTimeout(timer);
  }, [notice, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-2 bottom-14 z-20"
    >
      {notice && (
        <div
          key={notice.id}
          className="pointer-events-auto flex items-center gap-2 rounded-card bg-surface-raised px-3 py-2 text-footnote text-label shadow-float hairline-ring motion-safe:transition-[opacity,translate] motion-safe:duration-200 motion-safe:starting:translate-y-2 starting:opacity-0"
        >
          <p className={notice.tone === "danger" ? "flex-1 text-danger" : "flex-1"}>
            {notice.message}
          </p>
          {notice.action && (
            <button
              type="button"
              onClick={() => {
                notice.action?.run();
                onDismiss();
              }}
              className="rounded-[6px] px-2 py-1 font-semibold text-accent hover:bg-fill focus-visible:focus-ring"
            >
              {notice.action.label}
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t("common.dismiss")}
            className="flex size-6 items-center justify-center rounded-full text-label-secondary hover:bg-fill focus-visible:focus-ring"
          >
            <X aria-hidden="true" strokeWidth={2} className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
