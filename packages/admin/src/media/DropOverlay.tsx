import { Upload } from "lucide-react";
import { classNames } from "../design/classNames.js";
import { t } from "../i18n/strings.js";

/**
 * Shown while files are dragged over the page, so it's obvious that letting go uploads them.
 * It never takes the pointer, so the drop reaches the page underneath.
 */
export function DropOverlay({
  visible,
  contained = false,
}: {
  visible: boolean;
  contained?: boolean;
}) {
  return (
    <div
      aria-hidden={!visible}
      className={classNames(
        "pointer-events-none z-50 flex items-center justify-center p-4",
        "transition-opacity duration-150 ease-standard",
        contained ? "absolute inset-0" : "fixed inset-0",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <div className="absolute inset-0 bg-background/70 backdrop-blur-md" />
      <div
        className={classNames(
          "relative flex size-full flex-col items-center justify-center gap-3 rounded-panel",
          "border-2 border-dashed border-accent bg-accent/8 text-center",
          "transition-transform duration-200 ease-standard",
          visible ? "scale-100" : "motion-safe:scale-[0.98]",
        )}
      >
        <span className="flex size-16 items-center justify-center rounded-full bg-accent-fill text-on-accent shadow-float">
          <Upload aria-hidden="true" strokeWidth={1.75} className="size-7" />
        </span>
        <p className="text-title text-label">{t("media.drop.title")}</p>
        <p className="text-body text-label-secondary">{t("media.drop.description")}</p>
      </div>
    </div>
  );
}
