import { Package, Plus } from "lucide-react";
import { useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { EmptyState } from "../design/EmptyState.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LinkButton } from "../design/LinkButton.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { SearchField } from "../design/SearchField.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { Skeleton } from "../design/Skeleton.js";
import { useDebouncedValue } from "../media/useDebouncedValue.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { formatMoney } from "./money.js";
import { priceRangeText, type ProductStatus } from "./products.api.js";
import { ProductStatusBadge } from "./ProductStatusBadge.js";
import { useProducts } from "./shop.queries.js";

type StatusFilter = "all" | ProductStatus;

/** /commerce/products: everything the shop sells, with a search and a status filter. */
export function ProductsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const debouncedSearch = useDebouncedValue(search, 250);
  const query = {
    search: debouncedSearch || undefined,
    status: status === "all" ? undefined : status,
  };
  const products = useProducts(query);
  const canChange = useCan("commerce:update");
  const isFiltered = query.search !== undefined || query.status !== undefined;

  const addButton = canChange && (
    <LinkButton
      to="/commerce/products/$productId"
      params={{ productId: "new" }}
      icon={<Plus aria-hidden="true" />}
    >
      {t("shop.products.add")}
    </LinkButton>
  );

  return (
    <>
      <BackLink to="/commerce">{t("shop.title")}</BackLink>
      <LargeTitle
        title={t("shop.products.title")}
        subtitle={t("shop.products.subtitle")}
        actions={addButton}
      />

      <div className="mb-5 flex max-w-3xl flex-wrap items-center gap-3">
        <div className="min-w-60 flex-1">
          <SearchField label={t("shop.products.search")} value={search} onValueChange={setSearch} />
        </div>
        <SegmentedControl<StatusFilter>
          label={t("shop.products.statusFilter")}
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: t("shop.products.filterAll") },
            { value: "active", label: t("shop.status.active") },
            { value: "draft", label: t("shop.status.draft") },
            { value: "archived", label: t("shop.status.archived") },
          ]}
        />
      </div>

      {products.isError && (
        <LoadError error={products.error} onRetry={() => void products.refetch()} />
      )}
      {products.isPending && (
        <LoadingRegion label={t("shop.products.loading")}>
          <Skeleton className="h-40 max-w-3xl rounded-card" />
        </LoadingRegion>
      )}
      {products.data?.total === 0 && (
        <div className="max-w-3xl rounded-card bg-surface">
          {isFiltered ? (
            <EmptyState icon={Package} title={t("shop.products.noMatches")} />
          ) : (
            <EmptyState
              size="page"
              icon={Package}
              title={t("shop.products.emptyTitle")}
              description={t("shop.products.emptyDescription")}
              action={addButton}
            />
          )}
        </div>
      )}
      {products.data && products.data.total > 0 && (
        <div className="max-w-3xl">
          <GroupedList footer={t("shop.products.count", { count: products.data.total })}>
            {products.data.items.map((product) => {
              const price = priceRangeText(product.priceRange, formatMoney);
              const stock =
                product.available === null
                  ? t("shop.products.notTracked")
                  : t("shop.products.inStock", { count: product.available });
              return (
                <GroupedListRow
                  key={product.id}
                  icon={Package}
                  iconTone={product.status === "active" ? "accent" : "neutral"}
                  label={product.title}
                  description={[price ?? t("shop.products.noPrice"), stock].join(" · ")}
                  accessory={<ProductStatusBadge status={product.status} />}
                  to={`/commerce/products/${encodeURIComponent(product.id)}`}
                />
              );
            })}
          </GroupedList>
        </div>
      )}
    </>
  );
}
