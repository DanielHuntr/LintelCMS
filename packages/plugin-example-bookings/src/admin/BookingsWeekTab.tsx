import { useState } from "react";
import { BookingList } from "./BookingList.js";
import { daysLater, startOfToday } from "./dates.js";
import { t } from "./strings.js";

/** A tab beside the home dashboard: the next seven days of bookings. */
export function BookingsWeekTab() {
  const [today] = useState(() => startOfToday());
  return <BookingList from={today} to={daysLater(today, 7)} emptyTitle={t("bookings.weekEmpty")} />;
}
