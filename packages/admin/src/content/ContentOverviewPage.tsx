import { Plus, Shapes } from "lucide-react";
import { LoadError } from "../api/LoadError.js";
import { SiteWideContent } from "../content-model/SiteWideContent.js";
import { EmptyState } from "../design/EmptyState.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LinkButton } from "../design/LinkButton.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { CollectionCard } from "./CollectionCard.js";
import { useCollections } from "./content.queries.js";
import { useNow } from "./useNow.js";
import { classNames } from "../design/classNames.js";
import { autoFillGrid, Page } from "../design/Page.js";

/** /content: every collection as a card, the way into writing anything. */
export function ContentOverviewPage() {
  const collections = useCollections();
  const canDesignContentTypes = useCan("blueprints:update");
  const now = useNow();

  const isEmpty = collections.data?.length === 0;
  const newContentType = (variant: "filled" | "tinted") =>
    canDesignContentTypes && (
      <LinkButton
        to="/settings/content-types/new"
        variant={variant}
        icon={<Plus aria-hidden="true" />}
      >
        {t("contentTypes.new")}
      </LinkButton>
    );

  return (
    <Page width="wide">
      <LargeTitle
        title={t("content.title")}
        subtitle={t("content.subtitle")}
        // When there's nothing yet, the empty state offers the button instead.
        actions={isEmpty ? undefined : newContentType("tinted")}
      />

      {collections.isError && (
        <LoadError error={collections.error} onRetry={() => void collections.refetch()} />
      )}

      {collections.isPending && (
        <LoadingRegion label={t("content.loading")}>
          <div className={classNames(autoFillGrid(), "gap-4")}>
            {[0, 1, 2].map((card) => (
              <div key={card} className="flex flex-col gap-5 rounded-card bg-surface p-5">
                <Skeleton className="size-10 rounded-[10px]" />
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        </LoadingRegion>
      )}

      {isEmpty && (
        <div className="rounded-card bg-surface">
          <EmptyState
            size="page"
            icon={Shapes}
            title={t("content.emptyTitle")}
            description={
              canDesignContentTypes
                ? t("content.emptyDescription")
                : t("content.emptyDescriptionAskAdmin")
            }
            action={newContentType("filled")}
          />
        </div>
      )}

      {collections.data && collections.data.length > 0 && (
        <ul className={classNames(autoFillGrid(), "gap-4")}>
          {collections.data.map((collection) => (
            <CollectionCard key={collection.id} collection={collection} now={now} />
          ))}
        </ul>
      )}

      <SiteWideContent />
    </Page>
  );
}
