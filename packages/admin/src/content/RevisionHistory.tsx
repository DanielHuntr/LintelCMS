import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { Skeleton } from "../design/Skeleton.js";
import { t, type StringKey } from "../i18n/strings.js";
import type { Revision, RevisionAction } from "./content.types.js";
import { useRevisions } from "./content.queries.js";
import { PanelSection } from "./PanelSection.js";
import { formatDateTime, formatRelativeTime } from "./relativeTime.js";
import { useNow } from "./useNow.js";

const actionLabels: Record<RevisionAction, StringKey> = {
  saved: "revisions.saved",
  published: "revisions.published",
  unpublished: "revisions.unpublished",
  restored: "revisions.restored",
};

const initiallyShown = 6;

interface RevisionHistoryProps {
  /** Undefined until a new entry is first saved. */
  entryId: string | undefined;
  isWorking: boolean;
  onRestore: (revisionId: string) => Promise<void>;
}

/** Every save and publish of the entry, newest first, with a way back to any of them. */
export function RevisionHistory({ entryId, isWorking, onRestore }: RevisionHistoryProps) {
  const { data: revisions, isPending } = useRevisions(entryId);
  const [isShowingAll, setIsShowingAll] = useState(false);
  const [revisionToRestore, setRevisionToRestore] = useState<Revision | null>(null);
  const now = useNow();

  const shown = isShowingAll ? revisions : revisions?.slice(0, initiallyShown);

  return (
    <PanelSection title={t("editor.panel.history")}>
      {!entryId && <p className="text-footnote text-label-secondary">{t("revisions.none")}</p>}

      {entryId && isPending && (
        <div className="flex flex-col gap-2.5" aria-hidden="true">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </div>
      )}

      {shown && shown.length > 0 && (
        <ol className="-mx-1 flex flex-col">
          {shown.map((revision, index) => (
            <li
              key={revision.id}
              className="group flex items-center gap-2 rounded-control px-1 py-1.5 hover:bg-fill/60"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-footnote font-medium text-label">
                  {t(actionLabels[revision.action] ?? "revisions.saved")}
                  {index === 0 && (
                    <span className="ms-1.5 font-normal text-label-tertiary">
                      {t("revisions.current")}
                    </span>
                  )}
                </span>
                <span className="truncate text-caption text-label-secondary">
                  <time dateTime={revision.createdAt} title={formatDateTime(revision.createdAt)}>
                    {formatRelativeTime(revision.createdAt, now)}
                  </time>
                  {revision.author && ` · ${revision.author.name}`}
                </span>
              </span>
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => setRevisionToRestore(revision)}
                  disabled={isWorking}
                  aria-label={t("revisions.restoreNamed", {
                    date: formatDateTime(revision.createdAt),
                  })}
                  title={t("revisions.restore")}
                  className="flex size-7 shrink-0 items-center justify-center rounded-control text-label-secondary opacity-60 transition duration-150 ease-standard group-hover:opacity-100 hover:bg-fill hover:text-accent focus-visible:opacity-100 focus-visible:focus-ring disabled:opacity-30"
                >
                  <RotateCcw aria-hidden="true" strokeWidth={2} className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ol>
      )}

      {revisions && revisions.length > initiallyShown && (
        <button
          type="button"
          onClick={() => setIsShowingAll((wasShowingAll) => !wasShowingAll)}
          className="self-start rounded-[5px] text-footnote font-medium text-accent hover:underline focus-visible:focus-ring"
        >
          {isShowingAll
            ? t("revisions.showFewer")
            : t("revisions.showAll", { count: revisions.length })}
        </button>
      )}

      <ConfirmDialog
        open={revisionToRestore !== null}
        title={t("revisions.confirmTitle")}
        message={t("revisions.confirmMessage", {
          date: revisionToRestore ? formatDateTime(revisionToRestore.createdAt) : "",
        })}
        confirmLabel={t("revisions.restore")}
        cancelLabel={t("common.cancel")}
        isWorking={isWorking}
        onCancel={() => setRevisionToRestore(null)}
        onConfirm={() => {
          if (!revisionToRestore) return;
          void onRestore(revisionToRestore.id).finally(() => setRevisionToRestore(null));
        }}
      />
    </PanelSection>
  );
}
