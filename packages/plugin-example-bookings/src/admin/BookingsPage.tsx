import { LargeTitle, PluginLink, useCan } from "@lintel/admin/plugin";
import { Plus } from "lucide-react";
import { useState } from "react";
import { BookingList } from "./BookingList.js";
import { startOfToday } from "./dates.js";
import { t } from "./strings.js";

/** /bookings: everything from today onwards. */
export function BookingsPage() {
  const canManage = useCan("bookings:manage");
  const [today] = useState(() => startOfToday());
  return (
    <>
      <LargeTitle
        title={t("bookings.title")}
        subtitle={t("bookings.subtitle")}
        actions={
          canManage && (
            <PluginLink to="/bookings/new" variant="filled" icon={<Plus aria-hidden="true" />}>
              {t("bookings.new")}
            </PluginLink>
          )
        }
      />
      <BookingList
        from={today}
        emptyTitle={t("bookings.emptyTitle")}
        emptyDescription={t("bookings.emptyDescription")}
      />
    </>
  );
}
