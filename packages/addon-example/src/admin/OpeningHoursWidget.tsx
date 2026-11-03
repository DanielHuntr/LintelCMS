import { LoadError } from "@lintel/admin/plugin";
import { useQuery } from "@tanstack/react-query";
import { openingHoursKey, readOpeningHours, today } from "./openingHours.api.js";
import { t } from "./strings.js";

/** The dashboard widget: whether the shop is open today, and its hours. */
export function OpeningHoursWidget() {
  const hours = useQuery({ queryKey: openingHoursKey, queryFn: readOpeningHours });
  if (hours.isError) {
    return <LoadError error={hours.error} onRetry={() => void hours.refetch()} />;
  }
  if (!hours.data) {
    return <p className="text-footnote text-label-secondary">{t("hours.loading")}</p>;
  }
  const todaysHours = hours.data[today()];
  return (
    <div className="flex flex-col gap-1">
      <p className="text-footnote text-label-secondary">
        {todaysHours ? t("hours.openToday") : t("hours.closedToday")}
      </p>
      {todaysHours && <p className="text-title text-label">{todaysHours}</p>}
    </div>
  );
}
