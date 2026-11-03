import { MessageSquareText } from "lucide-react";
import { describeError } from "../api/describeError.js";
import { classNames } from "../design/classNames.js";
import { t } from "../i18n/strings.js";
import type { EntryReviewState } from "./clientEditing.api.js";
import { useSendForReview } from "./clientEditing.queries.js";

interface SendForReviewButtonProps {
  entryId: string;
  state: EntryReviewState;
  /** Saves anything not yet saved first, so the review covers what's on screen. */
  beforeSending?: () => Promise<unknown> | void;
  /** "toolbar" matches the page builder's small Publish; "bar" the entry editor's. */
  look?: "toolbar" | "bar";
  disabled?: boolean;
}

/**
 * Publish, for clients whose changes wait for approval: "Send for review", then "Waiting
 * for review" until someone answers.
 */
export function SendForReviewButton({
  entryId,
  state,
  beforeSending,
  look = "bar",
  disabled = false,
}: SendForReviewButtonProps) {
  const send = useSendForReview(entryId);
  const isWaiting = state.review?.status === "waiting";
  return (
    <>
      <button
        type="button"
        disabled={disabled || isWaiting || send.isPending}
        onClick={async () => {
          await beforeSending?.();
          send.mutate("");
        }}
        className={classNames(
          "shrink-0 font-semibold whitespace-nowrap focus-visible:focus-ring disabled:opacity-50",
          isWaiting ? "bg-fill text-label-secondary" : "bg-accent-fill text-on-accent",
          look === "toolbar"
            ? "h-8 rounded-control px-3 text-footnote"
            : "h-9 rounded-control px-4 text-body",
        )}
      >
        {send.isPending
          ? t("clientEditing.sending")
          : isWaiting
            ? t("clientEditing.waiting")
            : t("clientEditing.sendForReview")}
      </button>
      <span role="status" className="sr-only">
        {send.isSuccess ? t("clientEditing.sentAnnouncement") : ""}
      </span>
      {send.isError && (
        <span role="alert" className="text-footnote text-danger">
          {describeError(send.error)}
        </span>
      )}
    </>
  );
}

/** What the reviewer said when they sent the changes back, until they're sent again. */
export function SentBackNote({
  state,
  className,
}: {
  state: EntryReviewState | undefined;
  className?: string;
}) {
  const review = state?.review;
  if (review?.status !== "sentBack") return null;
  return (
    <div
      className={classNames(
        "flex items-start gap-2.5 rounded-card bg-warning/12 px-4 py-3 text-footnote text-label",
        className,
      )}
    >
      <MessageSquareText
        aria-hidden="true"
        strokeWidth={2}
        className="mt-px size-4 shrink-0 text-warning"
      />
      <p className="flex-1">
        <span className="font-semibold">
          {t("clientEditing.sentBack.title", {
            name: review.decidedByName ?? t("clientEditing.sentBack.someone"),
          })}
        </span>{" "}
        {review.decisionNote}
      </p>
    </div>
  );
}
