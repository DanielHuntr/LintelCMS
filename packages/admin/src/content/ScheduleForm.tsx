import { useId, useState, type FormEvent } from "react";
import { Button } from "../design/Button.js";
import { classNames } from "../design/classNames.js";
import { controlClasses } from "../design/controlStyles.js";
import { dateFromInput, localDateTimeText } from "../fields/dateValues.js";
import { t } from "../i18n/strings.js";

interface ScheduleFormProps {
  /** When it's already scheduled, the form starts at that time. */
  scheduledFor: string | null;
  isWorking: boolean;
  onSchedule: (publishAt: string) => void;
  onCancel: () => void;
}

/** Picks the date and time an entry goes live. The time is the person's own time zone. */
export function ScheduleForm({ scheduledFor, isWorking, onSchedule, onCancel }: ScheduleFormProps) {
  const inputId = useId();
  const errorId = useId();
  const [value, setValue] = useState(() =>
    localDateTimeText(scheduledFor ? new Date(scheduledFor) : oneHourFromNow()),
  );
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const publishAt = dateFromInput(value, true);
    if (!publishAt || new Date(publishAt).getTime() <= Date.now()) {
      setError(t("editor.schedule.mustBeFuture"));
      return;
    }
    onSchedule(publishAt);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 rounded-control bg-fill/60 p-3">
      <label htmlFor={inputId} className="text-footnote font-medium text-label">
        {t("editor.schedule.label")}
      </label>
      <input
        id={inputId}
        type="datetime-local"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setError(null);
        }}
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={classNames(
          "h-9 bg-surface tabular-nums",
          controlClasses({ hasError: Boolean(error) }),
        )}
      />
      {error && (
        <p id={errorId} className="text-footnote text-danger">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="plain" size="small" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" variant="tinted" size="small" disabled={isWorking}>
          {t("editor.schedule.confirm")}
        </Button>
      </div>
    </form>
  );
}

function oneHourFromNow(): Date {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  return date;
}
