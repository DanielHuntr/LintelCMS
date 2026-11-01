import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FilePlus2, SearchX } from "lucide-react";
import { useCallback, useState } from "react";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { EmptyState } from "../design/EmptyState.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LinkButton } from "../design/LinkButton.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t, tCount } from "../i18n/strings.js";
import { LocalePicker } from "../locales/LocalePicker.js";
import { useCan } from "../session/SessionContext.js";
import { reorderEntries } from "./content.api.js";
import { contentKeys, useCollection, useEntries } from "./content.queries.js";
import type { Collection, EntryPage, EntrySummary } from "./content.types.js";
import { EntriesToolbar, type StatusFilter } from "./EntriesToolbar.js";
import { entriesPerPage, type EntriesFilter } from "./entriesQuery.js";
import { EntryList } from "./EntryList.js";
import { Pagination } from "./Pagination.js";
import { newEntryId } from "./newEntryId.js";
import { Page } from "../design/Page.js";

interface EntriesListPageProps {
  collectionHandle: string;
  /** Kept in the URL by the router, so a filtered list can be bookmarked and shared. */
  filter: EntriesFilter;
  onFilterChange: (filter: EntriesFilter) => void;
}

/** A collection's entries: search, filter by status, reorder, and start a new one. */
export function EntriesListPage({
  collectionHandle,
  filter,
  onFilterChange,
}: EntriesListPageProps) {
  const collection = useCollection(collectionHandle);
  const entries = useEntries(collectionHandle, filter);
  const canCreate = useCan("entries:create");
  // Stable, because the toolbar's search waits for a pause and restarts when this changes.
  const handleSearchChange = useCallback(
    (search: string) => onFilterChange({ ...filter, search: search || undefined, page: 1 }),
    [filter, onFilterChange],
  );

  if (collection.isError) {
    return (
      <Page width="wide">
        <LoadError error={collection.error} onRetry={() => void collection.refetch()} />
      </Page>
    );
  }
  if (!collection.data) {
    return (
      <Page width="wide">
        <EntriesSkeleton />
      </Page>
    );
  }

  const { data: list } = entries;
  const isFiltered = Boolean(filter.status || filter.search);

  return (
    <Page width="wide">
      <LargeTitle
        title={collection.data.name}
        subtitle={
          list
            ? tCount({ one: "entries.count.one", other: "entries.count.other" }, list.total)
            : undefined
        }
        actions={
          <>
            <LocalePicker
              value={filter.locale}
              onChange={(locale) => onFilterChange({ ...filter, locale, page: 1 })}
            />
            {canCreate && (
              <LinkButton
                to="/content/$collection/$entryId"
                params={{ collection: collectionHandle, entryId: newEntryId }}
                search={{ locale: filter.locale }}
                icon={<FilePlus2 aria-hidden="true" />}
              >
                {t("entries.new")}
              </LinkButton>
            )}
          </>
        }
      />

      <EntriesToolbar
        collectionName={collection.data.name}
        search={filter.search ?? ""}
        status={filter.status ?? "all"}
        onSearchChange={handleSearchChange}
        onStatusChange={(status: StatusFilter) =>
          onFilterChange({ ...filter, status: status === "all" ? undefined : status, page: 1 })
        }
      />

      {entries.isError && (
        <LoadError error={entries.error} onRetry={() => void entries.refetch()} />
      )}
      {!list && !entries.isError && <RowsSkeleton />}
      {list && (
        <EntriesResults
          collection={collection.data}
          list={list}
          filter={filter}
          isFiltered={isFiltered}
          canCreate={canCreate}
          onPageChange={(page) => onFilterChange({ ...filter, page })}
        />
      )}
    </Page>
  );
}

interface EntriesResultsProps {
  collection: Collection;
  list: EntryPage;
  filter: EntriesFilter;
  isFiltered: boolean;
  canCreate: boolean;
  onPageChange: (page: number) => void;
}

function EntriesResults({
  collection,
  list,
  filter,
  isFiltered,
  canCreate,
  onPageChange,
}: EntriesResultsProps) {
  const queryClient = useQueryClient();
  const canReorder = useCan("entries:update");
  const [reorderError, setReorderError] = useState<string | null>(null);
  const listKey = contentKeys.entries(collection.handle, filter);

  const reorder = useMutation({
    mutationFn: (ordered: EntrySummary[]) =>
      reorderEntries(
        collection.handle,
        ordered.map(({ id, parentId }) => ({ id, parentId })),
      ),
    // Show the new order straight away, and put the old one back if the API says no.
    onMutate: (ordered) => {
      setReorderError(null);
      const previous = queryClient.getQueryData<EntryPage>(listKey);
      queryClient.setQueryData<EntryPage>(listKey, (page) => page && { ...page, entries: ordered });
      return { previous };
    },
    onError: (error, _ordered, context) => {
      queryClient.setQueryData(listKey, context?.previous);
      setReorderError(describeError(error));
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: contentKeys.collection(collection.handle) }),
  });

  if (list.entries.length === 0) {
    return isFiltered ? (
      <div className="rounded-card bg-surface">
        <EmptyState
          icon={SearchX}
          title={t("entries.noMatchesTitle")}
          description={t("entries.noMatchesDescription")}
        />
      </div>
    ) : (
      <div className="rounded-card bg-surface">
        <EmptyState
          size="page"
          icon={FilePlus2}
          title={t("entries.emptyTitle", { name: collection.name })}
          description={t("entries.emptyDescription")}
          action={
            canCreate && (
              <LinkButton
                to="/content/$collection/$entryId"
                params={{ collection: collection.handle, entryId: newEntryId }}
                search={{ locale: filter.locale }}
                variant="tinted"
              >
                {t("entries.new")}
              </LinkButton>
            )
          }
        />
      </div>
    );
  }

  // Reordering a filtered or searched list would be ambiguous, and dated lists sort themselves.
  const isOrderable = collection.structure !== "dated" && canReorder;
  const canReorderNow = isOrderable && !isFiltered;

  return (
    <>
      {reorderError && (
        <p role="alert" className="mb-3 text-footnote text-danger">
          {reorderError}
        </p>
      )}
      <EntryList
        collectionHandle={collection.handle}
        entries={list.entries}
        isTree={collection.structure === "tree" && !isFiltered}
        onReorder={canReorderNow ? (ordered) => reorder.mutate(ordered) : undefined}
      />
      {isOrderable && isFiltered && (
        <p className="mt-3 px-1 text-footnote text-label-secondary">{t("entries.reorderHint")}</p>
      )}
      <Pagination
        page={list.page}
        pageCount={Math.ceil(list.total / (list.perPage || entriesPerPage))}
        onPageChange={onPageChange}
      />
    </>
  );
}

function RowsSkeleton() {
  return (
    <LoadingRegion label={t("entries.loading")}>
      <div className="flex flex-col rounded-card bg-surface">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="flex items-center gap-3 px-5 py-3.5 [&+&]:hairline-top">
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

function EntriesSkeleton() {
  return (
    <>
      <div className="mb-8 flex items-end justify-between">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="mb-4 flex justify-between">
        <Skeleton className="h-8 w-80 rounded-full" />
        <Skeleton className="h-9 w-64" />
      </div>
      <RowsSkeleton />
    </>
  );
}
