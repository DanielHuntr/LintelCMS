import { Link, useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { classNames } from "../design/classNames.js";
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
import { TreeBranch } from "./TreeBranch.js";
import { rootKey, type TreeKey } from "./treeState.js";
import { iconForContent } from "./typeIcons.js";
import { TreeRow } from "./TreeRow.js";
import { useActionItems } from "./useActionItems.js";

/**
 * The content tree beside the main navigation: a site switcher when there is more than one
 * site, a filter, a section per collection (pages first), the site-wide content, and the
 * recycle bin at the bottom.
 */
export function ContentTree() {
  const tree = useContentTree();
  const roots = useTreeRoots(tree.siteId);
  const [filter, setFilter] = useState("");
  const search = useDebouncedValue(filter.trim(), 250);
  const [focusedKey, setFocusedKey] = useState<TreeKey | undefined>();
  const firstKey = roots.data?.roots[0] ? rootKey(roots.data.roots[0].handle) : undefined;
  const tabStopKey = focusedKey ?? tree.selectedKey ?? firstKey;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-col gap-2 px-2.5 pt-4 pb-2">
        {roots.data && roots.data.sites.length > 1 && (
          <SiteSwitcher
            sites={roots.data.sites}
            siteId={roots.data.site.id}
            onChange={(siteId) => tree.setSiteId(siteId)}
          />
        )}
        <SearchField
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
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3">
        {roots.isError && <LoadError error={roots.error} onRetry={() => void roots.refetch()} />}
        {roots.isPending && <TreeSkeleton />}
        {roots.data && search !== "" && <FilterResults search={search} />}
        {roots.data && search === "" && (
          <>
            <h2 className="px-2 pt-2 pb-1 text-caption font-semibold text-label-secondary uppercase">
              {t("tree.contentHeading")}
            </h2>
            <ul role="tree" aria-label={t("tree.label")} className="flex flex-col">
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

      <div className="hairline-top px-2.5 py-2">
        <Link
          to="/content/recycle-bin"
          aria-label={
            roots.data?.recycleBinCount === 1
              ? t("tree.recycleBinCountOne")
              : t("tree.recycleBinCount", { count: roots.data?.recycleBinCount ?? 0 })
          }
          className="flex h-8 items-center gap-2 rounded-control px-2 text-body text-label hover:bg-fill focus-visible:focus-ring data-[status=active]:bg-accent/12 data-[status=active]:text-accent"
        >
          <Trash2 aria-hidden="true" strokeWidth={1.75} className="size-4 text-label-secondary" />
          <span className="flex-1">{t("tree.recycleBin")}</span>
          {(roots.data?.recycleBinCount ?? 0) > 0 && (
            <span className="rounded-full bg-fill px-1.5 text-caption text-label-secondary tabular-nums">
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

/** A collection's section: its top level in the tree, or a folder whose items open as a list. */
function RootItem({ root, isSiteTop, tabStopKey, onRowFocus }: RootItemProps) {
  const tree = useContentTree();
  const navigate = useNavigate();
  const key = rootKey(root.handle);
  const actions = useActionItems({ kind: "root", root });
  const showsChildren = !root.childrenAsCollection;
  const isExpanded = showsChildren && tree.expanded.has(key);

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

interface SiteSwitcherProps {
  sites: { id: string; name: string }[];
  siteId: string;
  onChange: (siteId: string) => void;
}

/** Which website the tree shows, when this install serves more than one. */
function SiteSwitcher({ sites, siteId, onChange }: SiteSwitcherProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="px-1 text-caption font-medium text-label-secondary">{t("tree.site")}</span>
      <select
        value={siteId}
        onChange={(event) => onChange(event.target.value)}
        className={classNames(
          "h-8 rounded-control bg-fill/70 px-2 text-body text-label focus-visible:focus-ring",
        )}
      >
        {sites.map((site) => (
          <option key={site.id} value={site.id}>
            {site.name}
          </option>
        ))}
      </select>
    </label>
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
