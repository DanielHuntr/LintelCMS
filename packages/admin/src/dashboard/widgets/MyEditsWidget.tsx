import { History } from "lucide-react";
import { formatRelativeTime } from "../../content/relativeTime.js";
import { useNow } from "../../content/useNow.js";
import { t } from "../../i18n/strings.js";
import { EntryWidgetRows } from "./EntryWidgetRows.js";

/** The entries the signed-in person changed most recently. Also on the Content landing. */
export function MyEditsWidget() {
  const now = useNow();
  return (
    <EntryWidgetRows
      list="my-edits"
      loadingLabel={t("dashboard.loading")}
      empty={{
        icon: History,
        title: t("dashboard.myEdits.emptyTitle"),
        description: t("dashboard.myEdits.emptyDescription"),
      }}
      detail={(entry) =>
        t("dashboard.myEdits.detail", {
          collection: entry.collection.name,
          time: formatRelativeTime(entry.updatedAt, now),
        })
      }
    />
  );
}
