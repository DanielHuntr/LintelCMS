import { useState, type FormEvent } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { controlClasses } from "../design/controlStyles.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import type { Order } from "./orders.api.js";
import { formatOrderTime } from "./orderDates.js";
import { useAddOrderNote } from "./shop.queries.js";

/** Everything that happened to the order, newest first, and a box for staff notes. */
export function OrderTimeline({ order }: { order: Order }) {
  const [note, setNote] = useState("");
  const addNote = useAddOrderNote(order.id);
  const canWrite = useCan("commerce:update");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (note.trim() === "") return;
    addNote.mutate(note.trim(), { onSuccess: () => setNote("") });
  }

  return (
    <div className="flex flex-col gap-4">
      {canWrite && (
        <form onSubmit={submit} className="flex flex-col gap-2">
          <label htmlFor="order-note" className="text-footnote font-medium text-label">
            {t("shop.orders.noteLabel")}
          </label>
          <textarea
            id="order-note"
            rows={2}
            value={note}
            maxLength={5000}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t("shop.orders.notePlaceholder")}
            className={`${controlClasses()} py-2`}
          />
          {addNote.error && (
            <p role="alert" className="text-footnote text-danger">
              {describeError(addNote.error)}
            </p>
          )}
          <div>
            <Button
              type="submit"
              variant="tinted"
              size="small"
              disabled={addNote.isPending || note.trim() === ""}
            >
              {t("shop.orders.addNote")}
            </Button>
          </div>
        </form>
      )}
      <ol className="flex flex-col gap-3">
        {order.timeline.map((event) => (
          <li key={event.id} className="grid grid-cols-[auto_1fr] gap-3">
            <span
              aria-hidden="true"
              className={`mt-2 size-2 rounded-full ${event.kind === "note" ? "bg-accent-fill" : "bg-label-tertiary"}`}
            />
            <div>
              <p className="text-body text-label">{event.message}</p>
              <p className="text-footnote text-label-secondary">
                <time dateTime={event.createdAt}>{formatOrderTime(event.createdAt)}</time>
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
