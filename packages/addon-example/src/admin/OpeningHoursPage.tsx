import {
  GroupedList,
  GroupedListRow,
  LargeTitle,
  LoadError,
  LoadingRegion,
  Skeleton,
} from "@lintel/admin/plugin";
import { useQuery } from "@tanstack/react-query";
import { DAYS, openingHoursKey, readOpeningHours, today } from "./openingHours.api.js";
import { t } from "./strings.js";

/** /opening-hours: the week as the website shows it, with today marked. */
export function OpeningHoursPage() {
  const hours = useQuery({ queryKey: openingHoursKey, queryFn: readOpeningHours });
  const current = today();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6">
      <LargeTitle title={t("hours.title")} subtitle={t("hours.subtitle")} />
      {hours.isError && <LoadError error={hours.error} onRetry={() => void hours.refetch()} />}
      {hours.isPending && (
        <LoadingRegion label={t("hours.loading")}>
          <Skeleton className="h-80" />
        </LoadingRegion>
      )}
      {hours.data && (
        <GroupedList footer={hours.data.note || undefined}>
          {DAYS.map((day) => (
            <GroupedListRow
              key={day}
              label={t(`day.${day}`)}
              description={day === current ? t("hours.today") : undefined}
              detail={hours.data[day] || t("hours.closed")}
            />
          ))}
        </GroupedList>
      )}
    </div>
  );
}
