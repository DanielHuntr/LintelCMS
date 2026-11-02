import { LayoutGrid, Plus } from "lucide-react";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { EmptyState } from "../design/EmptyState.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LinkButton } from "../design/LinkButton.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { useProductCollections } from "./discounts.queries.js";

/** /commerce/collections: every product collection, and a way to add one. */
export function CollectionsPage() {
  const collections = useProductCollections();
  const canChange = useCan("commerce:update");
  const addButton = canChange && (
    <LinkButton
      to="/commerce/collections/$collectionId"
      params={{ collectionId: "new" }}
      icon={<Plus aria-hidden="true" />}
    >
      {t("shop.collections.add")}
    </LinkButton>
  );

  return (
    <>
      <BackLink to="/commerce">{t("shop.title")}</BackLink>
      <LargeTitle
        title={t("shop.collections.title")}
        subtitle={t("shop.collections.subtitle")}
        actions={collections.data?.length ? addButton : undefined}
      />
      {collections.isError && (
        <LoadError error={collections.error} onRetry={() => void collections.refetch()} />
      )}
      {collections.isPending && (
        <LoadingRegion label={t("shop.collections.loading")}>
          <Skeleton className="h-40 max-w-2xl rounded-card" />
        </LoadingRegion>
      )}
      {collections.data?.length === 0 && (
        <div className="max-w-2xl rounded-card bg-surface">
          <EmptyState
            size="page"
            icon={LayoutGrid}
            title={t("shop.collections.emptyTitle")}
            description={t("shop.collections.emptyDescription")}
            action={addButton}
          />
        </div>
      )}
      {collections.data && collections.data.length > 0 && (
        <div className="max-w-2xl">
          <GroupedList>
            {collections.data.map((collection) => (
              <GroupedListRow
                key={collection.id}
                icon={LayoutGrid}
                iconTone={collection.kind === "manual" ? "accent" : "neutral"}
                label={collection.title}
                description={t(
                  collection.kind === "manual"
                    ? "shop.collections.manualRow"
                    : "shop.collections.automaticRow",
                  { count: collection.productCount },
                )}
                to={`/commerce/collections/${encodeURIComponent(collection.id)}`}
              />
            ))}
          </GroupedList>
        </div>
      )}
    </>
  );
}
