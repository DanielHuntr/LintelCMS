import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { LoadError } from "../../api/LoadError.js";
import { EmptyState } from "../../design/EmptyState.js";
import { GroupedListRow } from "../../design/GroupedListRow.js";
import { LoadingRegion } from "../../design/LoadingRegion.js";
import { Skeleton } from "../../design/Skeleton.js";
import { t } from "../../i18n/strings.js";
import type { DashboardEntry, EntryWidgetList } from "../dashboard.api.js";
import { useEntryWidgetList } from "../dashboard.queries.js";

interface EntryWidgetRowsProps {
  list: EntryWidgetList;
  loadingLabel: string;
  empty: { icon: LucideIcon; title: string; description: string };
  /** The line under each entry's title. */
  detail: (entry: DashboardEntry) => string;
  accessory?: (entry: DashboardEntry) => ReactNode;
}

/** A short list of entries, each a link into the editor: what the entry widgets share. */
export function EntryWidgetRows({
  list,
  loadingLabel,
  empty,
  detail,
  accessory,
}: EntryWidgetRowsProps) {
  const entries = useEntryWidgetList(list);

  if (entries.isError) {
    return <LoadError error={entries.error} onRetry={() => void entries.refetch()} />;
  }
  if (!entries.data) {
    return (
      <LoadingRegion label={loadingLabel}>
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-9 w-full" />
          ))}
        </div>
      </LoadingRegion>
    );
  }
  if (entries.data.entries.length === 0) {
    return <EmptyState icon={empty.icon} title={empty.title} description={empty.description} />;
  }

  const more = entries.data.total - entries.data.entries.length;
  return (
    <>
      {/* The negative margins let separators run to the card's edge, as rows do in iOS. */}
      <ul className="-mx-5 -mb-2">
        {entries.data.entries.map((entry) => (
          <GroupedListRow
            key={entry.id}
            label={entry.title || t("entries.untitled")}
            description={detail(entry)}
            accessory={accessory?.(entry)}
            to={`/content/${entry.collection.handle}/${entry.id}`}
          />
        ))}
      </ul>
      {more > 0 && (
        <p className="mt-3 text-footnote text-label-secondary">
          {t("dashboard.more", { count: more })}
        </p>
      )}
    </>
  );
}
