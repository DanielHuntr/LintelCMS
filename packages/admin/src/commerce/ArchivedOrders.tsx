import { Archive } from "lucide-react";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { t } from "../i18n/strings.js";
import { formatMoney } from "./money.js";
import { formatOrderDate } from "./orderDates.js";
import { useArchivedOrders } from "./shopifyImport.queries.js";

/** A customer's orders from before the move from Shopify, shown only when there are some. */
export function ArchivedOrders({ customerId }: { customerId: string }) {
  const archived = useArchivedOrders(customerId);
  if (!archived.data || archived.data.length === 0) return null;
  return (
    <GroupedList
      header={t("shop.customers.archivedHeader")}
      footer={t("shop.customers.archivedFooter")}
    >
      {archived.data.map((order) => (
        <GroupedListRow
          key={order.id}
          icon={Archive}
          iconTone="neutral"
          label={order.name}
          description={`${formatOrderDate(order.placedAt)} · ${formatMoney(order.total)}`}
          detail={order.paymentStatus}
        />
      ))}
    </GroupedList>
  );
}
