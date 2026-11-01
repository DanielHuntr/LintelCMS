import { CircleAlert, CircleCheck, FileUp, X } from "lucide-react";
import { classNames } from "../design/classNames.js";
import { t } from "../i18n/strings.js";
import type { UploadItem } from "./useUploadQueue.js";

interface UploadProgressListProps {
  items: readonly UploadItem[];
  onDismiss: (key: string) => void;
}

/** One row per file: its name, then a progress bar, a tick, or what went wrong. */
export function UploadProgressList({ items, onDismiss }: UploadProgressListProps) {
  return (
    <ul className="flex flex-col">
      {items.map((item) => (
        <li key={item.key} className="flex items-start gap-3 py-2.5 not-first:hairline-top">
          <UploadStatusIcon status={item.status} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-footnote font-medium text-label">{item.name}</p>
            {item.status === "uploading" && (
              <div
                role="progressbar"
                aria-label={item.name}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(item.progress * 100)}
                className="mt-1.5 h-1 overflow-hidden rounded-full bg-fill"
              >
                <div
                  className="h-full rounded-full bg-accent-fill transition-[width] duration-200 ease-standard"
                  style={{ width: `${Math.max(4, item.progress * 100)}%` }}
                />
              </div>
            )}
            {item.status === "done" && (
              <p className="text-caption text-label-secondary">{t("media.uploads.done")}</p>
            )}
            {item.status === "failed" && (
              <p className="mt-0.5 text-caption text-danger">{item.error}</p>
            )}
          </div>
          {item.status !== "uploading" && (
            <button
              type="button"
              aria-label={t("media.uploads.dismiss", { name: item.name })}
              onClick={() => onDismiss(item.key)}
              className="-me-1 flex size-6 shrink-0 items-center justify-center rounded-full text-label-tertiary transition-colors duration-150 hover:bg-fill hover:text-label focus-visible:focus-ring"
            >
              <X aria-hidden="true" className="size-3.5" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function UploadStatusIcon({ status }: { status: UploadItem["status"] }) {
  const Icon = status === "done" ? CircleCheck : status === "failed" ? CircleAlert : FileUp;
  return (
    <Icon
      aria-hidden="true"
      strokeWidth={1.75}
      className={classNames(
        "mt-px size-[18px] shrink-0",
        status === "done" && "text-success",
        status === "failed" && "text-danger",
        status === "uploading" && "text-accent",
      )}
    />
  );
}
