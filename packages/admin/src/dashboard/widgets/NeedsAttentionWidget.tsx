import { ListTodo } from "lucide-react";
import { formatRelativeTime } from "../../content/relativeTime.js";
import { useNow } from "../../content/useNow.js";
import { Badge } from "../../design/Badge.js";
import { t } from "../../i18n/strings.js";
import { EntryWidgetRows } from "./EntryWidgetRows.js";

/** Drafts, and live entries with changes not yet published: the oldest first. */
export function NeedsAttentionWidget() {
  const now = useNow();
  return (
    <EntryWidgetRows
      list="needs-attention"
      loadingLabel={t("dashboard.loading")}
      empty={{
        icon: ListTodo,
        title: t("dashboard.attention.emptyTitle"),
        description: t("dashboard.attention.emptyDescription"),
      }}
      detail={(entry) =>
        t("dashboard.attention.detail", {
          collection: entry.collection.name,
          time: formatRelativeTime(entry.updatedAt, now),
        })
      }
      accessory={(entry) =>
        entry.status === "draft" ? (
          <Badge>{t("dashboard.attention.draft")}</Badge>
        ) : (
          <Badge tone="warning">{t("dashboard.attention.changes")}</Badge>
        )
      }
    />
  );
}
