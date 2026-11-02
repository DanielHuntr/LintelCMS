import { Check, MessageSquareWarning, Send } from "lucide-react";
import { useState } from "react";
import { describeError } from "../api/describeError.js";
import { PanelSection } from "../content/PanelSection.js";
import { formatDateTime } from "../content/relativeTime.js";
import { Badge } from "../design/Badge.js";
import { Button } from "../design/Button.js";
import type { Tone } from "../design/tones.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { TextAreaField } from "./FormControls.js";
import { useDecideApproval, useEntryReview, useSubmitForReview } from "./workflows.queries.js";
import type { EntryReview } from "./workflows.types.js";

interface EntryReviewSectionProps {
  /** Undefined until a new entry is first saved. */
  entryId: string | undefined;
  collectionName: string;
}

const stateTones: Record<EntryReview["state"], Tone> = {
  not_submitted: "neutral",
  in_review: "warning",
  approved: "success",
  changes_requested: "danger",
};

/**
 * Content approval in the entry editor's side panel: where the review stands, submitting
 * for review, and, for reviewers, approving or asking for changes. Shows nothing for
 * collections that don't need approval.
 */
export function EntryReviewSection({ entryId, collectionName }: EntryReviewSectionProps) {
  const review = useEntryReview(entryId);
  if (!entryId || !review.data?.required) return null;
  return <ReviewPanel entryId={entryId} collectionName={collectionName} review={review.data} />;
}

function ReviewPanel({
  entryId,
  collectionName,
  review,
}: {
  entryId: string;
  collectionName: string;
  review: EntryReview;
}) {
  const [note, setNote] = useState("");
  const [comment, setComment] = useState("");
  const submit = useSubmitForReview(entryId);
  const decide = useDecideApproval(entryId);
  const canEdit = useCan("entries:update");
  const error = submit.error ?? decide.error;
  const canSubmit =
    canEdit && (review.state === "not_submitted" || review.state === "changes_requested");

  return (
    <PanelSection
      title={t("workflowReview.title")}
      accessory={<Badge tone={stateTones[review.state]}>{t(`review.state.${review.state}`)}</Badge>}
    >
      <p className="text-footnote text-label-secondary">{describeState(review, collectionName)}</p>

      {review.canReview && review.pendingApprovalId && (
        <div className="flex flex-col gap-2">
          <TextAreaField
            label={t("review.commentLabel")}
            hint={t("review.commentHint")}
            rows={2}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="small"
              icon={<Check aria-hidden="true" />}
              disabled={decide.isPending}
              onClick={() =>
                decide.mutate({
                  approvalId: review.pendingApprovalId ?? "",
                  decision: "approve",
                  comment,
                })
              }
            >
              {t("review.approve")}
            </Button>
            <Button
              size="small"
              variant="tinted"
              icon={<MessageSquareWarning aria-hidden="true" />}
              disabled={decide.isPending}
              onClick={() =>
                decide.mutate({
                  approvalId: review.pendingApprovalId ?? "",
                  decision: "request_changes",
                  comment,
                })
              }
            >
              {t("review.requestChanges")}
            </Button>
          </div>
        </div>
      )}

      {canSubmit && (
        <div className="flex flex-col gap-2">
          <TextAreaField
            label={t("review.noteLabel")}
            placeholder={t("review.notePlaceholder")}
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <div>
            <Button
              size="small"
              variant="tinted"
              icon={<Send aria-hidden="true" />}
              disabled={submit.isPending}
              onClick={() => submit.mutate(note, { onSuccess: () => setNote("") })}
            >
              {submit.isPending
                ? t("review.submitting")
                : review.state === "changes_requested"
                  ? t("review.resubmit")
                  : t("review.submit")}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-footnote text-danger">
          {describeError(error)}
        </p>
      )}

      {review.history.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-caption font-semibold text-label-secondary">
            {t("review.historyLabel")}
          </h3>
          <ol className="flex flex-col gap-2">
            {review.history.map((item, index) => (
              <li key={`${item.at}-${index}`} className="flex flex-col text-footnote">
                <span className="text-label">
                  {item.kind === "expired"
                    ? t("review.history.expired")
                    : t(`review.history.${item.kind}`, { name: item.by ?? t("review.someone") })}
                </span>
                {item.comment && <span className="text-label-secondary">“{item.comment}”</span>}
                <time dateTime={item.at} className="text-caption text-label-tertiary">
                  {formatDateTime(item.at)}
                </time>
              </li>
            ))}
          </ol>
        </div>
      )}
    </PanelSection>
  );
}

function describeState(review: EntryReview, collectionName: string): string {
  if (review.state === "not_submitted" && review.changedSinceApproval)
    return t("review.description.changed");
  if (review.state === "not_submitted")
    return t("review.description.not_submitted", { collection: collectionName });
  if (review.state === "in_review")
    return t("review.description.in_review", {
      role: review.reviewerRoleName ?? review.reviewerRole ?? "",
    });
  return t(`review.description.${review.state}`);
}
