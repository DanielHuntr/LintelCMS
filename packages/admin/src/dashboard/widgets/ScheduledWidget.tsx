import { CalendarClock } from "lucide-react";
import { formatDateTime } from "../../content/relativeTime.js";
import { t } from "../../i18n/strings.js";
import { EntryWidgetRows } from "./EntryWidgetRows.js";

/** What will go live by itself, soonest first. */
export function ScheduledWidget() {
  return (
    <EntryWidgetRows
      list="scheduled"
      loadingLabel={t("dashboard.loading")}
      empty={{
        icon: CalendarClock,
        title: t("dashboard.scheduled.emptyTitle"),
        description: t("dashboard.scheduled.emptyDescription"),
      }}
      detail={(entry) =>
        t("dashboard.scheduled.detail", {
          collection: entry.collection.name,
          time: entry.scheduledFor ? formatDateTime(entry.scheduledFor) : "",
        })
      }
    />
  );
}
