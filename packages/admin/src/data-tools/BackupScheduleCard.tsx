import { ChevronsUpDown } from "lucide-react";
import { useId } from "react";
import { describeError } from "../api/describeError.js";
import { Card } from "../design/Card.js";
import { classNames } from "../design/classNames.js";
import { controlClasses } from "../design/controlStyles.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { t } from "../i18n/strings.js";
import type { BackupFrequency, BackupSchedule } from "./dataTools.api.js";
import { useSaveBackupSchedule } from "./dataTools.queries.js";

const keepChoices = [3, 7, 14, 30];

/** Daily or weekly backups, and how many to keep. Each change is saved straight away. */
export function BackupScheduleCard({
  schedule,
  canChange,
}: {
  schedule: BackupSchedule;
  canChange: boolean;
}) {
  const save = useSaveBackupSchedule();
  const keepId = useId();
  const hintId = useId();
  const shown = save.variables ?? schedule;

  const frequencies: Array<{ value: BackupFrequency; label: string }> = [
    { value: "off", label: t("backups.frequency.off") },
    { value: "daily", label: t("backups.frequency.daily") },
    { value: "weekly", label: t("backups.frequency.weekly") },
  ];
  const keepOptions = [...new Set([...keepChoices, shown.keep])].sort((a, b) => a - b);

  return (
    <Card title={t("backups.scheduleTitle")}>
      <div className="flex flex-wrap items-end gap-6">
        <div className="flex flex-col gap-1.5">
          <span className="text-footnote font-medium text-label" aria-hidden="true">
            {t("backups.scheduleLabel")}
          </span>
          {canChange ? (
            <SegmentedControl
              label={t("backups.scheduleLabel")}
              options={frequencies}
              value={shown.frequency}
              onChange={(frequency) => save.mutate({ ...shown, frequency })}
            />
          ) : (
            <p className="text-body text-label">{t(`backups.frequency.${shown.frequency}`)}</p>
          )}
        </div>
        {shown.frequency !== "off" && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={keepId} className="text-footnote font-medium text-label">
              {t("backups.keep")}
            </label>
            <div className="relative">
              <select
                id={keepId}
                value={shown.keep}
                disabled={!canChange}
                aria-describedby={hintId}
                onChange={(event) => save.mutate({ ...shown, keep: Number(event.target.value) })}
                className={classNames("h-9 appearance-none pe-9", controlClasses())}
              >
                {keepOptions.map((count) => (
                  <option key={count} value={count}>
                    {t("backups.keepOption", { count })}
                  </option>
                ))}
              </select>
              <ChevronsUpDown
                aria-hidden="true"
                strokeWidth={2}
                className="pointer-events-none absolute top-1/2 inset-e-3 size-4 -translate-y-1/2 text-label-secondary"
              />
            </div>
          </div>
        )}
      </div>
      <p id={hintId} className="mt-4 text-footnote text-label-secondary" aria-live="polite">
        {shown.frequency === "off" ? t("backups.scheduleOffHint") : t("backups.scheduleHint")}
        {save.isSuccess && ` ${t("backups.scheduleSaved")}`}
      </p>
      {save.isError && (
        <p role="alert" className="mt-2 text-footnote text-danger">
          {describeError(save.error)}
        </p>
      )}
    </Card>
  );
}
