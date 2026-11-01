import { PenLine } from "lucide-react";
import { formatRelativeTime } from "../../content/relativeTime.js";
import { useNow } from "../../content/useNow.js";
import { t } from "../../i18n/strings.js";
import { EntryWidgetRows } from "./EntryWidgetRows.js";

/** The entries changed most recently, by anyone, with who changed them. */
export function RecentEditsWidget() {
  const now = useNow();
  return (
    <EntryWidgetRows
      list="recent-edits"
      loadingLabel={t("dashboard.loading")}
      empty={{
        icon: PenLine,
        title: t("dashboard.recentEdits.emptyTitle"),
        description: t("dashboard.recentEdits.emptyDescription"),
      }}
      detail={(entry) => {
        const values = {
          collection: entry.collection.name,
          time: formatRelativeTime(entry.updatedAt, now),
          person: entry.updatedByName ?? "",
        };
        return entry.updatedByName
          ? t("dashboard.recentEdits.detail", values)
          : t("dashboard.recentEdits.detailNobody", values);
      }}
    />
  );
}
