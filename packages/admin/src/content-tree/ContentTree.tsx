import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { House, Plus, Trash2 } from "lucide-react";
import { useState, type DragEvent, type MouseEvent } from "react";
import { LoadError } from "../api/LoadError.js";
import { Button } from "../design/Button.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { SearchField } from "../design/SearchField.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useDebouncedValue } from "../media/useDebouncedValue.js";
import { useContentTree } from "./ContentTreeContext.js";
import type { TreeRoot } from "./contentTree.types.js";
import { useTreeRoots, useTreeSearch } from "./contentTree.queries.js";
import { SiteWideSection } from "./SiteWideSection.js";
import { nodeState } from "./treeActions.js";
import { TreeActionsMenu } from "./TreeActionsMenu.js";
import { TreeBranch } from "./TreeBranch.js";
import { type DropPosition, rootKey, type TreeKey } from "./treeState.js";
import { iconForContent } from "./typeIcons.js";
import { TreeRow } from "./TreeRow.js";
import { TreeSelectionBar } from "./TreeSelectionBar.js";
import { useActionItems } from "./useActionItems.js";

/**
 * The content tree beside the main navigation: a site switcher when there is more than one
 * site, a filter, a section per collection (pages first), the site-wide content, and the
 * recycle bin at the bottom. Pages are created at the top with the "+" beside Content, or a
 * right-click on empty space; until there is one, the tree offers to create the home page.
 */
export function ContentTree({ beside }: { beside?: ReactNode } = {}) {
  const tree = useContentTree();
  const roots = useTreeRoots(tree.siteId);
  const topActions = useActionItems({ kind: "top" });
  const canCreate = topActions.length > 0;
  const [topMenuAt, setTopMenuAt] = useState<{ x: number; y: number } | null>(null);
  const [filter, setFilter] = useState("");
  const search = useDebouncedValue(filter.trim(), 250);
  const [focusedKey, setFocusedKey] = useState<TreeKey | undefined>();
  const firstKey = roots.data?.roots[0] ? rootKey(roots.data.roots[0].handle) : undefined;
  const tabStopKey = focusedKey ?? tree.selectedKey ?? firstKey;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1.5 px-2.5 pt-4 pb-2">
        <SearchField
          className="min-w-0 flex-1"
          label={t("tree.filterPlaceholder")}
          aria-label={t("tree.filter")}
          value={filter}
          onValueChange={setFilter}
          onKeyDown={(event) => {
            if (event.key !== "ArrowDown") return;
            event.preventDefault();
            event.currentTarget
              .closest("[data-content-tree]")
              ?.querySelector<HTMLElement>("[data-tree-row]")
              ?.focus();
          }}
        />
        {beside}
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3"
        onContextMenu={(event: MouseEvent<HTMLDivElement>) => {
          // A right-click on a row opens that row's menu; on empty space, "Create".
          const target = event.target as Element;
          if (!canCreate || target.closest("[data-tree-row], a, button, input, select")) return;
          event.preventDefault();
          setTopMenuAt({ x: event.clientX, y: event.clientY });
        }}
      >
        {roots.isError && <LoadError error={roots.error} onRetry={() => void roots.refetch()} />}
        {roots.isPending && <TreeSkeleton />}
        {roots.data && search !== "" && <FilterResults search={search} />}
        {roots.data && search === "" && (
          <>
            <div className="flex items-center justify-between pt-1 pe-1">
              <h2 className="px-2 pt-1 pb-1 text-caption font-semibold text-label-secondary uppercase">
                {t("tree.contentHeading")}
              </h2>
              {canCreate && (
                <button
                  type="button"
                  aria-label={t("tree.createAtTop")}
                  title={t("tree.createAtTop")}
                  onClick={() => tree.runAction("create", { kind: "top" })}
                  className="flex size-6 items-center justify-center rounded-full text-label-secondary hover:bg-fill hover:text-label focus-visible:focus-ring"
                >
                  <Plus aria-hidden="true" strokeWidth={2} className="size-4" />
                </button>
              )}
            </div>
            {canCreate &&
              roots.data.siteStartCount === 0 &&
              roots.data.roots.some((root) => root.structure === "tree") && (
                <CreateHomeCard
                  onCreate={() => tree.runAction("create", { kind: "top", isHome: true })}
                />
              )}
            <ul
              role="tree"
              aria-label={t("tree.label")}
              aria-multiselectable="true"
              className="flex flex-col"
            >
              {roots.data.roots.map((root) => (
                <RootItem
                  key={root.handle}
                  root={root}
                  isSiteTop={
                    root.handle === roots.data.roots[0]?.handle && root.structure === "tree"
                  }
                  tabStopKey={tabStopKey}
                  onRowFocus={setFocusedKey}
                />
              ))}
            </ul>
            {roots.data.roots.length === 0 && (
              <p className="px-2 py-2 text-footnote text-label-secondary">{t("tree.noRoots")}</p>
            )}
            <SiteWideSection tabStopKey={tabStopKey} onRowFocus={setFocusedKey} />
          </>
        )}
      </div>

      {topMenuAt && (
        <TreeActionsMenu
          label={t("tree.createAtTop")}
          items={topActions}
          position={topMenuAt}
          onClose={() => setTopMenuAt(null)}
        />
      )}

      <TreeSelectionBar />

      <div className="hairline-top px-2.5 py-2">
        {/* The name starts with the words shown, and the count follows in words, not the bare
            number in the badge (LINTEL-A11Y-004, WCAG 2.5.3). */}
        <Link
          to="/content/recycle-bin"
          className="flex h-8 items-center gap-2 rounded-control px-2 text-body text-label hover:bg-fill focus-visible:focus-ring data-[status=active]:bg-accent/12 data-[status=active]:text-accent"
        >
          <Trash2 aria-hidden="true" strokeWidth={1.75} className="size-4 text-label-secondary" />
          <span className="flex-1">
            {t("tree.recycleBin")}
            <span className="sr-only">
              , {t("tree.recycleBinItems", { count: roots.data?.recycleBinCount ?? 0 })}
            </span>
          </span>
          {(roots.data?.recycleBinCount ?? 0) > 0 && (
            <span
              aria-hidden="true"
              className="rounded-full bg-fill px-1.5 text-caption text-label-secondary tabular-nums"
            >
              {roots.data?.recycleBinCount}
            </span>
          )}
        </Link>
      </div>
    </div>
  );
}

interface RootItemProps {
  root: TreeRoot;
  isSiteTop: boolean;
  tabStopKey: TreeKey | undefined;
  onRowFocus: (key: TreeKey) => void;
}

/** Until a page tree has a page at its top: what the home page is, and a button to make it. */
function CreateHomeCard({ onCreate }: { onCreate: () => void }) {
  return (
    <section
      aria-labelledby="create-home-title"
      className="mx-1 mt-1 mb-2 flex flex-col items-start gap-1.5 rounded-card bg-surface px-3 py-3 hairline-ring"
    >
      <House aria-hidden="true" strokeWidth={1.75} className="size-5 text-accent" />
      <h3 id="create-home-title" className="text-body font-semibold text-label">
        {t("tree.createHome.title")}
      </h3>
      <p className="text-footnote text-label-secondary">{t("tree.createHome.description")}</p>
      <Button size="small" onClick={onCreate} className="mt-1">
        {t("tree.createHome.action")}
      </Button>
    </section>
  );
}

/** A collection's section: its top level in the tree, or a folder whose items open as a list. */
function RootItem({ root, isSiteTop, tabStopKey, onRowFocus }: RootItemProps) {
  const tree = useContentTree();
  const navigate = useNavigate();
  const key = rootKey(root.handle);
  const actions = useActionItems({ kind: "root", root });
  const showsChildren = !root.childrenAsCollection;
  const isExpanded = showsChildren && tree.expanded.has(key);
  const [dropAt, setDropAt] = useState<DropPosition | undefined>();

  // Dropping a page on its own section puts it at the top, as a page of its own there.
  function acceptsDrop(): boolean {
    const dragged = tree.dragged;
    return (
      dragged !== undefined &&
      dragged.collection.handle === root.handle &&
      root.structure !== "dated"
    );
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDropAt(undefined);
    const dragged = tree.dragged;
    tree.setDragged(undefined);
    if (!dragged || !acceptsDrop()) return;
    void tree.moveWithUndo(dragged, null, Number.MAX_SAFE_INTEGER);
  }

  return (
    <TreeRow
      treeKey={key}
      depth={0}
      label={root.name}
      icon={iconForContent(root)}
      isSelected={tree.selectedKey === key}
      isTabStop={tabStopKey === key}
      onFocus={() => onRowFocus(key)}
      onOpen={() =>
        void navigate({ to: "/content/$collection", params: { collection: root.handle } })
      }
      isExpandable={showsChildren && root.childCount > 0}
      isExpanded={isExpanded}
      onToggle={() => tree.toggle(key)}
      count={
        root.childrenAsCollection
          ? {
              value: root.childCount,
              description: t("tree.childCount", { count: root.childCount }),
            }
          : undefined
      }
      actions={actions}
      drag={{
        draggable: false,
        onDragOver: (event) => {
          if (!acceptsDrop()) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setDropAt("inside");
        },
        onDragLeave: () => setDropAt(undefined),
        onDrop: handleDrop,
        dropIndicator: dropAt,
      }}
    >
      {isExpanded && root.childCount > 0 && (
        <TreeBranch
          place={{ collection: root.handle }}
          parentKey={key}
          depth={1}
          isSiteTop={isSiteTop}
          tabStopKey={tabStopKey}
          onRowFocus={onRowFocus}
        />
      )}
    </TreeRow>
  );
}

/** While the filter has text: the matching entries, wherever they are. */
function FilterResults({ search }: { search: string }) {
  const tree = useContentTree();
  const navigate = useNavigate();
  const results = useTreeSearch(search, tree.siteId);
  const items = results.data?.items ?? [];

  return (
    <div aria-live="polite">
      <h2 className="px-2 pt-2 pb-1 text-caption font-semibold text-label-secondary uppercase">
        {t("tree.filterResults", { search })}
      </h2>
      {results.data && items.length === 0 && (
        <p className="px-2 py-2 text-footnote text-label-secondary">
          {t("tree.filterNoResults", { search })}
        </p>
      )}
      <ul role="tree" aria-label={t("tree.filterResults", { search })}>
        {items.map((node, index) => (
          <TreeRow
            key={node.id}
            treeKey={node.id}
            depth={0}
            label={node.title || t("tree.untitled")}
            icon={iconForContent(node.collection)}
            isSelected={tree.selectedKey === node.id}
            isTabStop={index === 0}
            onFocus={() => undefined}
            onOpen={() =>
              void navigate({
                to: "/content/$collection/$entryId",
                params: { collection: node.collection.handle, entryId: node.id },
              })
            }
            isExpandable={false}
            isExpanded={false}
            state={nodeState(node)}
          />
        ))}
      </ul>
    </div>
  );
}

function TreeSkeleton() {
  return (
    <LoadingRegion label={t("tree.loading")}>
      <div className="flex flex-col gap-3 px-2 pt-3">
        {[0, 1, 2, 3].map((row) => (
          <Skeleton key={row} className={row % 2 ? "h-4 w-28" : "h-4 w-40"} />
        ))}
      </div>
    </LoadingRegion>
  );
}
