import { Check, CircleAlert } from "lucide-react";
import { t } from "../i18n/strings.js";
import type { SaveStatus } from "./entryDraft.js";

interface SaveIndicatorProps {
  status: SaveStatus;
  hasUnsavedChanges: boolean;
  /** The API's message when the last save failed. */
  errorMessage: string | null;
  onRetry: () => void;
}

/**
 * A quiet word in the toolbar: "Edited", "Saving…", "Saved". Only the outcomes are announced
 * to screen readers ("Saved", "Couldn't save"), so autosave doesn't talk over typing.
 */
export function SaveIndicator({
  status,
  hasUnsavedChanges,
  errorMessage,
  onRetry,
}: SaveIndicatorProps) {
  const announcement =
    status === "failed" ? t("editor.saveFailed") : status === "saved" ? t("editor.saved") : "";

  return (
    <div className="flex min-w-0 items-center text-footnote">
      <span role="status" className="sr-only">
        {announcement}
      </span>
      <VisibleState
        status={status}
        hasUnsavedChanges={hasUnsavedChanges}
        errorMessage={errorMessage}
        onRetry={onRetry}
      />
    </div>
  );
}

function VisibleState({ status, hasUnsavedChanges, errorMessage, onRetry }: SaveIndicatorProps) {
  if (status === "saving") {
    return (
      <span aria-hidden="true" className="text-label-tertiary">
        {t("editor.saving")}
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span className="flex items-center gap-1.5 text-danger" title={errorMessage ?? undefined}>
        <CircleAlert aria-hidden="true" strokeWidth={2} className="size-3.5" />
        <span aria-hidden="true">{t("editor.saveFailed")}</span>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-[5px] px-1 font-medium underline-offset-2 hover:underline focus-visible:focus-ring"
        >
          {t("editor.saveRetry")}
        </button>
      </span>
    );
  }

  if (hasUnsavedChanges) {
    return (
      <span aria-hidden="true" className="text-label-tertiary">
        {t("editor.edited")}
      </span>
    );
  }

  if (status === "saved") {
    return (
      <span aria-hidden="true" className="flex items-center gap-1 text-label-tertiary">
        <Check aria-hidden="true" strokeWidth={2.25} className="size-3.5" />
        {t("editor.saved")}
      </span>
    );
  }

  return null;
}
