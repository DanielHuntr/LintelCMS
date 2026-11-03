import { ClipboardCheck } from "lucide-react";
import { useId, useState } from "react";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { EmptyState } from "../design/EmptyState.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import type { ClientReviewListItem } from "./clientEditing.api.js";
import { useAnswerReview, useWaitingReviews } from "./clientEditing.queries.js";

/**
 * Clients' changes waiting for review, oldest first, each a link to the entry. People who
 * may publish and design approve them (they go live) or send them back with a note.
 */
export function WaitingForReviewWidget() {
  const reviews = useWaitingReviews();
  const canPublish = useCan("entries:publish");
  const canDesign = useCan("builder:design");
  const canAnswer = canPublish && canDesign;
  const answer = useAnswerReview();
  const [sendingBack, setSendingBack] = useState<ClientReviewListItem | null>(null);
  const [message, setMessage] = useState("");

  if (reviews.isError) {
    return <LoadError error={reviews.error} onRetry={() => void reviews.refetch()} />;
  }
  if (!reviews.data) {
    return (
      <LoadingRegion label={t("dashboard.loading")}>
        <div className="flex flex-col gap-3">
          {[0, 1].map((row) => (
            <Skeleton key={row} className="h-9 w-full" />
          ))}
        </div>
      </LoadingRegion>
    );
  }
  if (reviews.data.length === 0) {
    return (
      <>
        <EmptyState
          icon={ClipboardCheck}
          title={t("clientEditing.widget.emptyTitle")}
          description={t("clientEditing.widget.emptyDescription")}
        />
        <span role="status" className="sr-only">
          {message}
        </span>
      </>
    );
  }

  return (
    <>
      <ul className="-mx-5 -mb-2">
        {reviews.data.map((review) => (
          <GroupedListRow
            key={review.id}
            label={review.entry.title || t("entries.untitled")}
            description={t("clientEditing.widget.detail", {
              collection: review.entry.collectionName,
              name: review.requestedByName ?? t("clientEditing.sentBack.someone"),
            })}
            to={`/content/${review.entry.collection}/${review.entry.id}`}
            accessory={
              canAnswer ? (
                <span className="flex items-center gap-1">
                  <Button
                    size="small"
                    variant="plain"
                    disabled={answer.isPending}
                    onClick={() => setSendingBack(review)}
                  >
                    {t("clientEditing.widget.sendBack")}
                  </Button>
                  <Button
                    size="small"
                    variant="tinted"
                    disabled={answer.isPending}
                    onClick={() =>
                      answer.mutate(
                        { reviewId: review.id, approve: true },
                        {
                          onSuccess: () =>
                            setMessage(
                              t("clientEditing.widget.approved", {
                                title: review.entry.title || t("entries.untitled"),
                              }),
                            ),
                        },
                      )
                    }
                  >
                    {t("clientEditing.widget.approve")}
                  </Button>
                </span>
              ) : undefined
            }
          />
        ))}
      </ul>
      {answer.isError && !sendingBack && (
        <p role="alert" className="mt-3 text-footnote text-danger">
          {describeError(answer.error)}
        </p>
      )}
      <span role="status" className="sr-only">
        {message}
      </span>
      {sendingBack && (
        <SendBackDialog
          review={sendingBack}
          isSending={answer.isPending}
          error={answer.isError ? describeError(answer.error) : null}
          onCancel={() => {
            answer.reset();
            setSendingBack(null);
          }}
          onSend={(note) =>
            answer.mutate(
              { reviewId: sendingBack.id, note },
              {
                onSuccess: () => {
                  setMessage(
                    t("clientEditing.widget.sentBack", {
                      name: sendingBack.requestedByName ?? t("clientEditing.sentBack.someone"),
                    }),
                  );
                  setSendingBack(null);
                },
              },
            )
          }
        />
      )}
    </>
  );
}

function SendBackDialog({
  review,
  isSending,
  error,
  onCancel,
  onSend,
}: {
  review: ClientReviewListItem;
  isSending: boolean;
  error: string | null;
  onCancel: () => void;
  onSend: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const noteId = useId();
  return (
    <Dialog
      open
      onClose={onCancel}
      size="alert"
      title={t("clientEditing.sendBack.title", {
        title: review.entry.title || t("entries.untitled"),
      })}
      description={t("clientEditing.sendBack.description")}
      footer={
        <>
          <Button variant="plain" onClick={onCancel}>
            {t("clientEditing.sendBack.cancel")}
          </Button>
          <Button disabled={isSending || note.trim() === ""} onClick={() => onSend(note.trim())}>
            {t("clientEditing.sendBack.confirm")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={noteId} className="text-footnote font-medium text-label">
          {t("clientEditing.sendBack.note")}
        </label>
        <textarea
          id={noteId}
          data-autofocus
          rows={3}
          maxLength={1000}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="rounded-control bg-fill px-3 py-2 text-body text-label focus-visible:focus-ring"
        />
        {error && (
          <p role="alert" className="text-footnote text-danger">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
