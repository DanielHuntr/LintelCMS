import { Users } from "lucide-react";
import { useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { EmptyState } from "../design/EmptyState.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { SearchField } from "../design/SearchField.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useDebouncedValue } from "../media/useDebouncedValue.js";
import { formatMoney } from "./money.js";
import { useCustomers } from "./shop.queries.js";

/** /commerce/customers: everyone who has bought something, with what they've spent. */
export function CustomersPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const customers = useCustomers(debouncedSearch);

  return (
    <>
      <BackLink to="/commerce">{t("shop.title")}</BackLink>
      <LargeTitle title={t("shop.customers.title")} subtitle={t("shop.customers.subtitle")} />
      <div className="mb-5 max-w-3xl">
        <SearchField label={t("shop.customers.search")} value={search} onValueChange={setSearch} />
      </div>
      {customers.isError && (
        <LoadError error={customers.error} onRetry={() => void customers.refetch()} />
      )}
      {customers.isPending && (
        <LoadingRegion label={t("shop.customers.loading")}>
          <Skeleton className="h-40 max-w-3xl rounded-card" />
        </LoadingRegion>
      )}
      {customers.data?.total === 0 && (
        <div className="max-w-3xl rounded-card bg-surface">
          {debouncedSearch ? (
            <EmptyState icon={Users} title={t("shop.customers.noMatches")} />
          ) : (
            <EmptyState
              size="page"
              icon={Users}
              title={t("shop.customers.emptyTitle")}
              description={t("shop.customers.emptyDescription")}
            />
          )}
        </div>
      )}
      {customers.data && customers.data.total > 0 && (
        <div className="max-w-3xl">
          <GroupedList>
            {customers.data.items.map((customer) => (
              <GroupedListRow
                key={customer.id}
                icon={Users}
                iconTone="warning"
                label={customer.name || customer.email}
                description={[
                  customer.email,
                  t("shop.customers.orders", { count: customer.orderCount }),
                  ...customer.totalSpent.map(formatMoney),
                ].join(" · ")}
                to={`/commerce/customers/${encodeURIComponent(customer.id)}`}
              />
            ))}
          </GroupedList>
        </div>
      )}
    </>
  );
}
