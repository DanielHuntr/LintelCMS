import { AlertTriangle, Info, X } from "lucide-react";
import { useState } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import {
  useApplyPendingModelChanges,
  useContentModelStatus,
  useDismissModelNotice,
} from "./contentModelSync.queries.js";

/**
 * What the content model sync needs people to know, on the content types screen:
 * changes from the files that wait for a confirmation (with what each would delete),
 * problems that stop the files being read, and notices such as "your change was undone
 * because the file was edited at the same time".
 */
export function ModelSyncNotices() {
  const status = useContentModelStatus().data;
  if (!status?.managedInCode) {
    return null;
  }
  return (
    <div
      aria-label={t("modelSync.noticesLabel")}
      role="region"
      className="mb-6 flex flex-col gap-3"
    >
      {status.problems.length > 0 && <FileProblems problems={status.problems} />}
      {status.pending.length > 0 && <PendingChanges />}
      {status.notices.map((notice) => (
        <Notice key={notice.id} id={notice.id} message={notice.message} />
      ))}
    </div>
  );
}

function FileProblems({ problems }: { problems: string[] }) {
  return (
    <section role="alert" className="rounded-card bg-surface p-4">
      <h2 className="flex items-center gap-2 text-headline text-danger">
        <AlertTriangle aria-hidden="true" className="size-4" />
        {t("modelSync.problemsTitle")}
      </h2>
      <p className="mt-1 text-body text-label-secondary">{t("modelSync.problemsDescription")}</p>
      <ul className="mt-2 list-disc ps-5 font-mono text-footnote">
        {problems.map((problem) => (
          <li key={problem}>{problem}</li>
        ))}
      </ul>
    </section>
  );
}

function PendingChanges() {
  const pending = useContentModelStatus().data?.pending ?? [];
  const canApply = useCan("blueprints:update");
  const apply = useApplyPendingModelChanges();
  const [confirming, setConfirming] = useState(false);

  return (
    <section aria-labelledby="pending-model-changes" className="rounded-card bg-surface p-4">
      <h2 id="pending-model-changes" className="flex items-center gap-2 text-headline text-warning">
        <AlertTriangle aria-hidden="true" className="size-4" />
        {t("modelSync.pendingTitle")}
      </h2>
      <p className="mt-1 text-body text-label-secondary">{t("modelSync.pendingDescription")}</p>
      <ul className="mt-3 flex flex-col gap-2">
        {pending.map((change) => (
          <li key={`${change.summary}${change.impact ?? ""}`} className="text-body">
            <span className={change.destructive ? "font-semibold" : undefined}>
              <WithHandles text={change.summary} />
            </span>
            {change.impact && (
              <span className="block text-footnote text-label-secondary">
                <WithHandles text={change.impact} />
              </span>
            )}
          </li>
        ))}
      </ul>
      {canApply && (
        <div className="mt-4">
          <Button variant="destructive" onClick={() => setConfirming(true)}>
            {t("modelSync.pendingApply")}
          </Button>
          {apply.isError && (
            <p role="alert" className="mt-2 text-footnote text-danger">
              {describeError(apply.error)}
            </p>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirming}
        title={t("modelSync.pendingConfirmTitle")}
        message={t("modelSync.pendingConfirmMessage")}
        confirmLabel={t("modelSync.pendingConfirm")}
        cancelLabel={t("modelSync.cancel")}
        isDestructive
        isWorking={apply.isPending}
        onConfirm={() => apply.mutate(undefined, { onSettled: () => setConfirming(false) })}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
}

function Notice({ id, message }: { id: string; message: string }) {
  const dismiss = useDismissModelNotice();
  return (
    <div role="status" className="flex items-start gap-3 rounded-card bg-surface p-4">
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />
      <p className="flex-1 text-body">{message}</p>
      <button
        type="button"
        onClick={() => dismiss.mutate(id)}
        aria-label={t("modelSync.noticeDismiss")}
        className="flex size-7 shrink-0 items-center justify-center rounded-control text-label-secondary hover:bg-fill focus-visible:focus-ring"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

/** The API writes handles in backticks (`excerpt`); they're shown as code. */
function WithHandles({ text }: { text: string }) {
  return text.split("`").map((part, index) =>
    index % 2 === 1 ? (
      <code key={index} className="font-mono text-[0.92em]">
        {part}
      </code>
    ) : (
      part
    ),
  );
}
