import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import type { Revision } from "./content.types.js";
import { useRevisions } from "./content.queries.js";
import { PanelSection } from "./PanelSection.js";
import { formatDateTime, formatRelativeTime } from "./relativeTime.js";
import { groupRevisionsByDay, revisionLabel } from "./revisionLabels.js";
import { useNow } from "./useNow.js";

/** History can grow long; the latest few are what people look for. */
export const revisionsPerPage = 20;

interface RevisionHistoryProps {
  /** Undefined until a new entry is first saved. */
  entryId: string | undefined;
  isWorking: boolean;
  onRestore: (revisionId: string) => Promise<void>;
}

/**
 * What happened to the entry, newest first and grouped by day, with a way back to any
 * version. One person's autosaves appear as a single "Edited" line (see the API's
 * revision-log.ts), so the list shows moments that matter rather than every keystroke.
 */
export function RevisionHistory({ entryId, isWorking, onRestore }: RevisionHistoryProps) {
  const { data: revisions, isPending } = useRevisions(entryId);
  const [shownCount, setShownCount] = useState(revisionsPerPage);
  const [revisionToRestore, setRevisionToRestore] = useState<Revision | null>(null);
  const now = useNow();

  const shown = revisions?.slice(0, shownCount) ?? [];
  const latestId = revisions?.[0]?.id;

  return (
    <PanelSection title={t("editor.panel.history")}>
      {!entryId && <p className="text-footnote text-label-secondary">{t("revisions.none")}</p>}

      {entryId && isPending && (
        <div className="flex flex-col gap-2.5" aria-hidden="true">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </div>
      )}

      {groupRevisionsByDay(shown, now).map((day) => (
        <section key={day.key} aria-label={day.label} className="flex flex-col">
          <h4 className="pb-1 text-caption font-semibold tracking-wide text-label-tertiary uppercase">
            {day.label}
          </h4>
          <ol className="-mx-1 flex flex-col">
            {day.revisions.map((revision) => {
              const isLatest = revision.id === latestId;
              return (
                <li
                  key={revision.id}
                  className="group flex items-center gap-2 rounded-control px-1 py-1.5 hover:bg-fill-strong/75"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-footnote font-medium text-label">
                      {revisionLabel(revision, isLatest)}
                    </span>
                    <span className="truncate text-caption text-label-secondary">
                      <time
                        dateTime={revision.updatedAt}
                        title={formatDateTime(revision.updatedAt)}
                      >
                        {formatRelativeTime(revision.updatedAt, now)}
                      </time>
                      {revision.author && ` · ${revision.author.name}`}
                    </span>
                  </span>
                  {!isLatest && (
                    <button
                      type="button"
                      onClick={() => setRevisionToRestore(revision)}
                      disabled={isWorking}
                      aria-label={t("revisions.restoreNamed", {
                        date: formatDateTime(revision.updatedAt),
                      })}
                      title={t("revisions.restore")}
                      className="flex size-7 shrink-0 items-center justify-center rounded-control text-label-secondary opacity-60 transition duration-150 ease-standard group-hover:opacity-100 hover:bg-fill hover:text-accent focus-visible:opacity-100 focus-visible:focus-ring disabled:opacity-30"
                    >
                      <RotateCcw aria-hidden="true" strokeWidth={2} className="size-3.5" />
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      {revisions && revisions.length > shownCount && (
        <button
          type="button"
          onClick={() => setShownCount((count) => count + revisionsPerPage)}
          className="self-start rounded-[5px] text-footnote font-medium text-accent hover:underline focus-visible:focus-ring"
        >
          {t("revisions.showOlder")}
        </button>
      )}

      <ConfirmDialog
        open={revisionToRestore !== null}
        title={t("revisions.confirmTitle")}
        message={t("revisions.confirmMessage", {
          date: revisionToRestore ? formatDateTime(revisionToRestore.updatedAt) : "",
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
