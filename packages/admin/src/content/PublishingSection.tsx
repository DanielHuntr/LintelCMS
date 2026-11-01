import { CalendarClock, EyeOff } from "lucide-react";
import { useState } from "react";
import { Button } from "../design/Button.js";
import { t } from "../i18n/strings.js";
import type { Entry } from "./content.types.js";
import { EntryStatusBadge } from "./EntryStatusBadge.js";
import { PanelSection } from "./PanelSection.js";
import { formatDateTime } from "./relativeTime.js";
import { ScheduleForm } from "./ScheduleForm.js";

interface PublishingSectionProps {
  /** Undefined until a new entry is first saved. */
  entry: Entry | undefined;
  canPublish: boolean;
  isWorking: boolean;
  onUnpublish: () => void;
  onSchedule: (publishAt: string) => void;
}

/**
 * Where the entry stands: its status, whether the site shows an older version, and the
 * less common publishing actions. Publish itself is the main button in the toolbar.
 */
export function PublishingSection({
  entry,
  canPublish,
  isWorking,
  onUnpublish,
  onSchedule,
}: PublishingSectionProps) {
  const [isScheduling, setIsScheduling] = useState(false);
  const status = entry?.status ?? "draft";

  return (
    <PanelSection title={t("editor.panel.status")} accessory={<EntryStatusBadge status={status} />}>
      <p className="text-footnote text-label-secondary">{statusDescription(entry)}</p>

      {entry?.hasUnpublishedChanges && status === "published" && (
        <p className="flex gap-2 rounded-control bg-warning/12 px-3 py-2 text-footnote text-label">
          <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warning" />
          <span>
            <strong className="font-semibold">{t("editor.unpublishedChanges")}</strong>{" "}
            {t("editor.unpublishedChangesDescription")}
          </span>
        </p>
      )}

      {!canPublish && (
        <p className="text-footnote text-label-secondary">{t("editor.cannotPublish")}</p>
      )}

      {canPublish && entry && isScheduling && (
        <ScheduleForm
          scheduledFor={entry.scheduledFor}
          isWorking={isWorking}
          onCancel={() => setIsScheduling(false)}
          onSchedule={(publishAt) => {
            setIsScheduling(false);
            onSchedule(publishAt);
          }}
        />
      )}

      {canPublish && entry && !isScheduling && (
        <div className="flex flex-wrap gap-2">
          {status !== "published" && (
            <Button
              variant="tinted"
              size="small"
              icon={<CalendarClock aria-hidden="true" />}
              onClick={() => setIsScheduling(true)}
              disabled={isWorking}
            >
              {status === "scheduled" ? t("editor.reschedule") : t("editor.schedule")}
            </Button>
          )}
          {status !== "draft" && (
            <Button
              variant="tinted"
              size="small"
              icon={<EyeOff aria-hidden="true" />}
              onClick={onUnpublish}
              disabled={isWorking}
            >
              {status === "scheduled" ? t("editor.cancelSchedule") : t("editor.unpublish")}
            </Button>
          )}
        </div>
      )}
    </PanelSection>
  );
}

function statusDescription(entry: Entry | undefined): string {
  if (!entry) return t("editor.statusNew");
  if (entry.status === "scheduled" && entry.scheduledFor) {
    return t("editor.statusScheduled", { date: formatDateTime(entry.scheduledFor) });
  }
  if (entry.status === "published" && entry.publishedAt) {
    return t("editor.statusPublished", { date: formatDateTime(entry.publishedAt) });
  }
  return t("editor.statusDraft");
}
