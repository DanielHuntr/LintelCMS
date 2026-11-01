import { Mail, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { formatDateTime } from "../content/relativeTime.js";
import { Button } from "../design/Button.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import {
  useAddNote,
  useDeleteNote,
  useDeleteSubmission,
  useSubmission,
  useUpdateSubmission,
} from "./forms.queries.js";
import type { FormField, SubmissionDetail as Detail } from "./forms.types.js";
import {
  answerText,
  formatFileSize,
  isFileList,
  otherAnswers,
  submissionTitle,
} from "./submissionValues.js";
import { TextAreaField } from "./TextAreaField.js";

interface SubmissionDetailProps {
  formId: string;
  submissionId: string;
  fields: readonly FormField[];
  onDeleted: () => void;
}

/** One submission: every answer, who sent it and when, and the team's notes. */
export function SubmissionDetail(props: SubmissionDetailProps) {
  const submission = useSubmission(props.formId, props.submissionId);
  if (submission.isError) {
    return <LoadError error={submission.error} onRetry={() => void submission.refetch()} />;
  }
  if (!submission.data) {
    return (
      <LoadingRegion label={t("forms.inbox.loadingOne")}>
        <Skeleton className="h-64 rounded-card" />
      </LoadingRegion>
    );
  }
  return <LoadedSubmission key={submission.data.id} {...props} submission={submission.data} />;
}

function LoadedSubmission({
  formId,
  fields,
  submission,
  onDeleted,
}: SubmissionDetailProps & { submission: Detail }) {
  const canUpdate = useCan("forms:update");
  const canDelete = useCan("forms:delete");
  const update = useUpdateSubmission(formId, submission.id);
  const addNote = useAddNote(formId, submission.id);
  const deleteNote = useDeleteNote(formId, submission.id);
  const deleteSubmission = useDeleteSubmission(formId);
  const [note, setNote] = useState("");
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const answers = fields.filter((field) => field.type !== "step");
  const extra = otherAnswers(submission, fields);
  const title = submissionTitle(submission, fields);

  return (
    <article
      aria-labelledby="submission-title"
      className="flex flex-col gap-5 rounded-card bg-surface p-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="submission-title" className="truncate text-title text-label">
            {title}
          </h2>
          <p className="text-footnote text-label-secondary">
            {t("forms.inbox.sentAt", { when: formatDateTime(submission.createdAt) })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {submission.submitterEmail && (
            <a
              href={`mailto:${submission.submitterEmail}`}
              className="inline-flex h-7 items-center gap-1.5 rounded-full bg-accent/12 px-3 text-footnote font-medium text-accent hover:bg-accent/18 focus-visible:focus-ring"
            >
              <Mail aria-hidden="true" className="size-3.5" />
              {t("forms.inbox.reply")}
            </a>
          )}
          {canUpdate && (
            <>
              <Button
                size="small"
                variant="tinted"
                aria-pressed={submission.isStarred}
                icon={
                  <Star
                    aria-hidden="true"
                    className={submission.isStarred ? "fill-current" : undefined}
                  />
                }
                onClick={() => update.mutate({ isStarred: !submission.isStarred })}
              >
                {submission.isStarred ? t("forms.inbox.starred") : t("forms.inbox.star")}
              </Button>
              <Button
                size="small"
                variant="plain"
                onClick={() => update.mutate({ isRead: !submission.isRead })}
              >
                {submission.isRead ? t("forms.inbox.markUnread") : t("forms.inbox.markRead")}
              </Button>
            </>
          )}
          {canDelete && (
            <Button
              size="small"
              variant="destructive"
              icon={<Trash2 aria-hidden="true" />}
              onClick={() => setIsConfirmingDelete(true)}
            >
              {t("forms.inbox.delete")}
            </Button>
          )}
        </div>
      </header>

      <dl className="flex flex-col gap-4">
        {answers.map((field) => (
          <div key={field.id} className="flex flex-col gap-0.5">
            <dt className="text-footnote text-label-secondary">{field.label}</dt>
            <dd className="text-body break-words whitespace-pre-wrap text-label">
              <Answer value={submission.values[field.handle]} />
            </dd>
          </div>
        ))}
        {extra.map(([handle, value]) => (
          <div key={handle} className="flex flex-col gap-0.5">
            <dt className="text-footnote text-label-secondary">
              {t("forms.inbox.removedField", { handle })}
            </dt>
            <dd className="text-body whitespace-pre-wrap text-label">
              <Answer value={value} />
            </dd>
          </div>
        ))}
      </dl>

      {submission.sourceUrl && (
        <p className="text-footnote text-label-secondary">
          {t("forms.inbox.sentFrom")}{" "}
          <a
            href={submission.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-accent underline"
          >
            {submission.sourceUrl}
          </a>
        </p>
      )}

      <section aria-labelledby="notes-heading" className="flex flex-col gap-3 pt-2 hairline-top">
        <h3 id="notes-heading" className="pt-3 text-headline text-label">
          {t("forms.inbox.notes")}
        </h3>
        {submission.notes.length === 0 && (
          <p className="text-footnote text-label-secondary">{t("forms.inbox.noNotes")}</p>
        )}
        <ul className="flex flex-col gap-2">
          {submission.notes.map((item) => (
            <li key={item.id} className="rounded-control bg-fill/60 px-3 py-2">
              <p className="text-body whitespace-pre-wrap text-label">{item.body}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="text-caption text-label-secondary">
                  {t("forms.inbox.noteBy", {
                    name: item.author?.name ?? t("forms.inbox.someone"),
                    when: formatDateTime(item.createdAt),
                  })}
                </p>
                {canUpdate && (
                  <Button size="small" variant="plain" onClick={() => deleteNote.mutate(item.id)}>
                    {t("forms.inbox.deleteNote")}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {canUpdate && (
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (note.trim() === "") return;
              addNote.mutate(note.trim(), { onSuccess: () => setNote("") });
            }}
          >
            <TextAreaField
              label={t("forms.inbox.addNote")}
              hint={t("forms.inbox.addNoteHint")}
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            <div>
              <Button type="submit" size="small" disabled={addNote.isPending || note.trim() === ""}>
                {t("forms.inbox.saveNote")}
              </Button>
            </div>
          </form>
        )}
      </section>

      <ConfirmDialog
        open={isConfirmingDelete}
        title={t("forms.inbox.deleteTitle")}
        message={t("forms.inbox.deleteMessage")}
        confirmLabel={t("forms.inbox.delete")}
        cancelLabel={t("common.cancel")}
        isDestructive
        isWorking={deleteSubmission.isPending}
        onCancel={() => setIsConfirmingDelete(false)}
        onConfirm={() =>
          deleteSubmission.mutate(submission.id, {
            onSuccess: () => {
              setIsConfirmingDelete(false);
              onDeleted();
            },
          })
        }
      />
    </article>
  );
}

function Answer({ value }: { value: Parameters<typeof answerText>[0] }) {
  if (value === undefined || answerText(value) === "") {
    return <span className="text-label-tertiary">{t("forms.inbox.noAnswer")}</span>;
  }
  if (isFileList(value)) {
    return (
      <ul className="flex flex-col gap-1">
        {value.map((file) => (
          <li key={file.assetId}>
            <a href={file.url} target="_blank" rel="noreferrer" className="text-accent underline">
              {file.filename}
            </a>{" "}
            <span className="text-footnote text-label-secondary">
              ({formatFileSize(file.size)})
            </span>
          </li>
        ))}
      </ul>
    );
  }
  return <>{answerText(value)}</>;
}
