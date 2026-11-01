import {
  EmptyState,
  GroupedList,
  GroupedListRow,
  LoadError,
  LoadingRegion,
  Skeleton,
} from "@lintel/admin/plugin";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { listBookings } from "./bookings.api.js";
import { formatTime, groupByDay } from "./dates.js";
import { t } from "./strings.js";

interface BookingListProps {
  from: Date;
  to?: Date;
  emptyTitle: string;
  emptyDescription?: string;
}

/** Bookings in a span of time, one group per day, each a link to its form. */
export function BookingList({ from, to, emptyTitle, emptyDescription }: BookingListProps) {
  const bookings = useQuery({
    queryKey: ["bookings", from.toISOString(), to?.toISOString()],
    queryFn: () => listBookings({ from, to }),
  });

  if (bookings.isError) {
    return <LoadError error={bookings.error} onRetry={() => void bookings.refetch()} />;
  }
  if (!bookings.data) {
    return (
      <LoadingRegion label={t("bookings.loading")}>
        <Skeleton className="h-32 w-full rounded-card" />
      </LoadingRegion>
    );
  }
  if (bookings.data.length === 0) {
    return (
      <div className="rounded-card bg-surface">
        <EmptyState icon={CalendarDays} title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      {groupByDay(bookings.data).map(({ day, items }) => (
        <GroupedList key={day} header={day}>
          {items.map((booking) => (
            <GroupedListRow
              key={booking.id}
              label={booking.customerName}
              description={t("bookings.detail", {
                time: formatTime(booking.startsAt),
                minutes: booking.durationMinutes,
              })}
              to={`/bookings/${booking.id}`}
            />
          ))}
        </GroupedList>
      ))}
    </div>
  );
}
