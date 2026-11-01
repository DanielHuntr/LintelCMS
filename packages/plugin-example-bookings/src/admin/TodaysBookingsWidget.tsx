import { LoadError, PluginLink, type WidgetProps } from "@lintel/admin/plugin";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listBookings } from "./bookings.api.js";
import { daysLater, formatTime, startOfToday } from "./dates.js";
import { t } from "./strings.js";

/** The dashboard widget "Today's bookings": who is coming in today, and when. */
export function TodaysBookingsWidget({ size }: WidgetProps) {
  const [today] = useState(() => startOfToday());
  const bookings = useQuery({
    queryKey: ["bookings", "today", today.toISOString()],
    queryFn: () => listBookings({ from: today, to: daysLater(today, 1) }),
  });

  if (bookings.isError) {
    return <LoadError error={bookings.error} onRetry={() => void bookings.refetch()} />;
  }
  if (!bookings.data) {
    return <p className="text-footnote text-label-secondary">{t("bookings.loading")}</p>;
  }
  // A small widget shows the next few; bigger ones have room for the whole day.
  const shown = size === "small" ? bookings.data.slice(0, 3) : bookings.data;

  return (
    <div className="flex flex-col gap-4">
      {shown.length === 0 ? (
        <p className="text-body text-label-secondary">{t("bookings.todayEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((booking) => (
            <li key={booking.id} className="flex items-baseline gap-3">
              <span className="w-16 shrink-0 text-footnote font-medium text-accent tabular-nums">
                {formatTime(booking.startsAt)}
              </span>
              <span className="min-w-0 truncate text-body text-label">{booking.customerName}</span>
            </li>
          ))}
        </ul>
      )}
      <PluginLink to="/bookings" variant="tinted" size="small">
        {t("bookings.seeAll")}
      </PluginLink>
    </div>
  );
}
