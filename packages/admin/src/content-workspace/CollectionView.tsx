import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, FileText, Plus, SearchX } from "lucide-react";
import { useEffect, useState } from "react";
import { LoadError } from "../api/LoadError.js";
import type { EntryStatus } from "../content/content.types.js";
import { formatRelativeTime } from "../content/relativeTime.js";
import { useNow } from "../content/useNow.js";
import { useContentTree } from "../content-tree/ContentTreeContext.js";
import type {
  CollectionItem,
  CollectionQuery,
  TreeNode,
  TreePlace,
  TreeRoot,
} from "../content-tree/contentTree.types.js";
import { COLLECTION_PAGE_SIZE, useCollectionItems } from "../content-tree/contentTree.queries.js";
import { StatusDot } from "../content-tree/StatusDot.js";
import { nodeState } from "../content-tree/treeActions.js";
import { Button } from "../design/Button.js";
import { classNames } from "../design/classNames.js";
import { EmptyState } from "../design/EmptyState.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { SearchField } from "../design/SearchField.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useDebouncedValue } from "../media/useDebouncedValue.js";
import { useCan } from "../session/SessionContext.js";
import { BulkActionBar } from "./BulkActionBar.js";
import { formatColumnValue } from "./columnValues.js";

type Layout = "table" | "grid";

interface CollectionViewProps {
  place: TreePlace;
  placeName: string;
  /** For a collection's own page: its section, so Create starts there. */
  root?: TreeRoot;
  /** The search, filter, sort and page, when the address keeps them; otherwise kept here. */
  query?: CollectionQuery;
  onQueryChange?: (query: CollectionQuery) => void;
}

const statusOptions: readonly ("all" | EntryStatus)[] = ["all", "draft", "published", "scheduled"];

/**
 * A long list in the workspace instead of the tree (Umbraco's collection view): a table or
 * a grid, with columns from the fields the content type picks, search, a status filter,
 * sorting by any column, actions on many items at once, and pages of 25.
 */
export function CollectionView({
  place,
  placeName,
  root,
  query,
  onQueryChange,
}: CollectionViewProps) {
  const tree = useContentTree();
  const now = useNow();
  const [ownQuery, setOwnQuery] = useState<CollectionQuery>({});
  const current = query ?? ownQuery;
  const change = (next: CollectionQuery) => (onQueryChange ?? setOwnQuery)(next);
  const [searchText, setSearchText] = useState(current.search ?? "");
  const search = useDebouncedValue(searchText.trim(), 300);
  const effective = { ...current, search: search === "" ? undefined : search };
  const items = useCollectionItems(place, effective);
  const [layout, setLayout] = useState<Layout>("table");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const canCreate = useCan("entries:create");

  const searchInQuery = current.search ?? "";
  useEffect(() => {
    // Keep the address (or own state) in step with what is typed, once typing pauses.
    if (search !== searchInQuery) {
      change({ ...current, search: search === "" ? undefined : search, page: undefined });
    }
    // Only a settled search should change the query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const rows = items.data?.items ?? [];
  const pages = Math.max(1, Math.ceil((items.data?.total ?? 0) / COLLECTION_PAGE_SIZE));
  const page = current.page ?? 1;
  const isFiltered = effective.search !== undefined || current.status !== undefined;
  const selectedNodes = rows.filter((row) => selected.has(row.id));

  function toggleSort(sort: string) {
    const isSame = current.sort === sort;
    change({
      ...current,
      sort,
      direction: isSame && current.direction !== "desc" ? "desc" : "asc",
      page: undefined,
    });
  }

  function startCreate() {
    if ("parentId" in place) {
      tree.runAction("create", { kind: "entry", node: placeholderNode(place.parentId, placeName) });
    } else if (root) {
      tree.runAction("create", { kind: "root", root });
    }
  }

  return (
    <section
      aria-label={t("collectionView.title", { place: placeName })}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-end gap-3">
        <SearchField
          label={t("collectionView.search", { place: placeName })}
          value={searchText}
          onValueChange={setSearchText}
          className="w-64"
        />
        <label className="flex items-center gap-2 text-footnote text-label-secondary">
          {t("collectionView.status")}
          <select
            value={current.status ?? "all"}
            onChange={(event) => {
              const value = event.target.value;
              change({
                ...current,
                status: value === "all" ? undefined : (value as EntryStatus),
                page: undefined,
              });
            }}
            className="h-9 rounded-control bg-fill/70 px-2 text-body text-label focus-visible:focus-ring"
          >
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {option === "all" ? t("collectionView.status.all") : t(`entry.status.${option}`)}
              </option>
            ))}
          </select>
        </label>
        <span className="flex-1" />
        <SegmentedControl
          label={t("collectionView.layout")}
          options={[
            { value: "table", label: t("collectionView.layout.table") },
            { value: "grid", label: t("collectionView.layout.grid") },
          ]}
          value={layout}
          onChange={setLayout}
        />
        {canCreate && (root || "parentId" in place) && (
          <Button icon={<Plus aria-hidden="true" />} onClick={startCreate}>
            {t("collectionView.create")}
          </Button>
        )}
      </div>

      <BulkActionBar nodes={selectedNodes} onDone={() => setSelected(new Set())} />

      {items.isError && <LoadError error={items.error} onRetry={() => void items.refetch()} />}
      {items.isPending && (
        <LoadingRegion label={t("collectionView.loading")}>
          <Skeleton className="h-64 w-full rounded-card" />
        </LoadingRegion>
      )}
      {items.data && rows.length === 0 && (
        <div className="rounded-card bg-surface">
          <EmptyState
            size="page"
            icon={isFiltered ? SearchX : FileText}
            title={isFiltered ? t("collectionView.noMatches") : t("collectionView.empty")}
            description={
              isFiltered
                ? t("collectionView.noMatchesDescription")
                : t("collectionView.emptyDescription")
            }
          />
        </div>
      )}

      {items.data && rows.length > 0 && layout === "table" && (
        <div className="overflow-x-auto rounded-card bg-surface">
          <table className="w-full text-left text-body">
            <thead className="text-footnote text-label-secondary">
              <tr className="hairline-bottom">
                <th scope="col" className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label={t("collectionView.selectAll")}
                    checked={rows.every((row) => selected.has(row.id))}
                    onChange={(event) =>
                      setSelected(
                        event.target.checked ? new Set(rows.map((row) => row.id)) : new Set(),
                      )
                    }
                    className="size-4 accent-(--color-accent-fill)"
                  />
                </th>
                <SortableHeader
                  label={t("collectionView.column.title")}
                  sort="title"
                  current={current}
                  onSort={toggleSort}
                />
                {items.data.columns.map((column) => (
                  <SortableHeader
                    key={column.handle}
                    label={column.label}
                    sort={`field:${column.handle}`}
                    current={current}
                    onSort={toggleSort}
                  />
                ))}
                <SortableHeader
                  label={t("collectionView.column.status")}
                  sort="status"
                  current={current}
                  onSort={toggleSort}
                />
                <SortableHeader
                  label={t("collectionView.column.updated")}
                  sort="updated"
                  current={current}
                  onSort={toggleSort}
                />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="hairline-top first:border-t-0 hover:bg-fill/50">
                  <td className="px-3 py-2">
                    <SelectBox row={row} selected={selected} onChange={setSelected} />
                  </td>
                  <td className="max-w-80 px-3 py-2">
                    <ItemLink row={row} />
                  </td>
                  {items.data.columns.map((column) => (
                    <td
                      key={column.handle}
                      className="max-w-64 truncate px-3 py-2 text-label-secondary"
                    >
                      {formatColumnValue(row.values[column.handle])}
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2 text-footnote text-label-secondary">
                      <StatusDot state={nodeState(row)} />
                      {t(`tree.status.${nodeState(row)}`)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-footnote whitespace-nowrap text-label-secondary">
                    {formatRelativeTime(row.updatedAt, now)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {items.data && rows.length > 0 && layout === "grid" && (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-col gap-2 rounded-card bg-surface p-4">
              <div className="flex items-center gap-2">
                <SelectBox row={row} selected={selected} onChange={setSelected} />
                <StatusDot state={nodeState(row)} />
                <span className="flex-1" />
                <span className="text-caption text-label-tertiary">
                  {formatRelativeTime(row.updatedAt, now)}
                </span>
              </div>
              <ItemLink row={row} />
              {items.data.columns.map((column) => {
                const value = formatColumnValue(row.values[column.handle]);
                return value ? (
                  <p
                    key={column.handle}
                    className="line-clamp-2 text-footnote text-label-secondary"
                  >
                    {value}
                  </p>
                ) : null;
              })}
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav
          aria-label={t("collectionView.page", { page, pages })}
          className="flex items-center justify-end gap-2"
        >
          <span className="text-footnote text-label-secondary">
            {t("collectionView.page", { page, pages })}
          </span>
          <Button
            variant="plain"
            size="small"
            disabled={page <= 1}
            onClick={() => change({ ...current, page: page - 1 === 1 ? undefined : page - 1 })}
          >
            {t("collectionView.previous")}
          </Button>
          <Button
            variant="plain"
            size="small"
            disabled={page >= pages}
            onClick={() => change({ ...current, page: page + 1 })}
          >
            {t("collectionView.next")}
          </Button>
        </nav>
      )}
    </section>
  );
}

/** Enough of a tree node for Create to know where it is making something. */
function placeholderNode(parentId: string, title: string): TreeNode {
  return {
    id: parentId,
    title,
    slug: "",
    status: "draft",
    hasUnpublishedChanges: false,
    scheduledFor: null,
    updatedAt: new Date().toISOString(),
    parentId: null,
    locale: "",
    collection: { handle: "", name: "" },
    childCount: 0,
    childrenAsCollection: true,
  };
}

function ItemLink({ row }: { row: CollectionItem }) {
  return (
    <Link
      to="/content/$collection/$entryId"
      params={{ collection: row.collection.handle, entryId: row.id }}
      className="block truncate rounded-[4px] font-medium text-label hover:text-accent focus-visible:focus-ring"
    >
      {row.title || t("tree.untitled")}
    </Link>
  );
}

interface SelectBoxProps {
  row: CollectionItem;
  selected: ReadonlySet<string>;
  onChange: (selected: ReadonlySet<string>) => void;
}

function SelectBox({ row, selected, onChange }: SelectBoxProps) {
  return (
    <input
      type="checkbox"
      aria-label={t("collectionView.select", { title: row.title || t("tree.untitled") })}
      checked={selected.has(row.id)}
      onChange={(event) => {
        const next = new Set(selected);
        if (event.target.checked) next.add(row.id);
        else next.delete(row.id);
        onChange(next);
      }}
      className="size-4 accent-(--color-accent-fill)"
    />
  );
}

interface SortableHeaderProps {
  label: string;
  sort: string;
  current: CollectionQuery;
  onSort: (sort: string) => void;
}

function SortableHeader({ label, sort, current, onSort }: SortableHeaderProps) {
  const isSorted = current.sort === sort;
  const direction = isSorted ? (current.direction ?? "asc") : undefined;
  return (
    <th
      scope="col"
      aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"}
      className="px-3 py-2 font-medium"
    >
      <button
        type="button"
        onClick={() => onSort(sort)}
        aria-label={t("collectionView.sortBy", { column: label })}
        className={classNames(
          "inline-flex items-center gap-1 rounded-[4px] hover:text-label focus-visible:focus-ring",
          isSorted && "text-label",
        )}
      >
        {label}
        {direction === "asc" && <ArrowUp aria-hidden="true" className="size-3" />}
        {direction === "desc" && <ArrowDown aria-hidden="true" className="size-3" />}
      </button>
    </th>
  );
}
