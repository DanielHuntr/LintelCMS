import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type DragEvent } from "react";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useContentTree } from "./ContentTreeContext.js";
import type { TreeNode, TreePlace } from "./contentTree.types.js";
import { TREE_PAGE_SIZE, useTreeChildren } from "./contentTree.queries.js";
import { nodeState } from "./treeActions.js";
import { dropPosition, type DropPosition, moveForDrop, type TreeKey } from "./treeState.js";
import { iconForContent } from "./typeIcons.js";
import { TreeRow } from "./TreeRow.js";
import { useActionItems } from "./useActionItems.js";

interface TreeBranchProps {
  place: TreePlace;
  parentKey: TreeKey;
  depth: number;
  /** For a collection's section: the first page at its top is the site's home. */
  isSiteTop?: boolean;
  tabStopKey: TreeKey | undefined;
  onRowFocus: (key: TreeKey) => void;
}

/**
 * The rows under one place, a page of them at a time, with "Show more" for the rest. Each
 * row's own branch is drawn when it is open, so only what someone opens is ever loaded.
 */
export function TreeBranch({
  place,
  parentKey,
  depth,
  isSiteTop = false,
  tabStopKey,
  onRowFocus,
}: TreeBranchProps) {
  const { siteId } = useContentTree();
  const level = useTreeChildren(place, siteId, true);
  const nodes = level.data?.pages.flatMap((page) => page.items) ?? [];
  const total = level.data?.pages[0]?.total ?? 0;

  if (level.isPending) {
    return (
      <ul role="group" aria-busy="true" className="flex flex-col gap-1 py-1">
        <li role="none" style={{ paddingLeft: 26 + depth * 14 }}>
          <Skeleton className="h-4 w-32" />
        </li>
      </ul>
    );
  }

  const siblingIds = nodes.map((node) => node.id);
  return (
    <ul role="group">
      {nodes.length === 0 && (
        <li
          role="none"
          style={{ paddingLeft: 32 + depth * 14 }}
          className="py-1 text-footnote text-label-tertiary"
        >
          {t("tree.emptyFolder")}
        </li>
      )}
      {nodes.map((node, index) => (
        <EntryTreeItem
          key={node.id}
          node={node}
          parentKey={parentKey}
          depth={depth}
          siblingIds={siblingIds}
          isHome={isSiteTop && index === 0}
          tabStopKey={tabStopKey}
          onRowFocus={onRowFocus}
        />
      ))}
      {level.hasNextPage && (
        <li role="none" style={{ paddingLeft: 26 + depth * 14 }}>
          <button
            type="button"
            onClick={() => void level.fetchNextPage()}
            disabled={level.isFetchingNextPage}
            className="h-7 rounded-control px-2 text-footnote text-accent hover:bg-fill focus-visible:focus-ring"
          >
            {t("tree.showMore", { count: Math.min(TREE_PAGE_SIZE, total - nodes.length) })}
          </button>
        </li>
      )}
    </ul>
  );
}

interface EntryTreeItemProps {
  node: TreeNode;
  parentKey: TreeKey;
  depth: number;
  siblingIds: readonly string[];
  isHome: boolean;
  tabStopKey: TreeKey | undefined;
  onRowFocus: (key: TreeKey) => void;
}

/** An entry's row: opens its workspace, drags to move, and opens its branch. */
function EntryTreeItem({
  node,
  parentKey,
  depth,
  siblingIds,
  isHome,
  tabStopKey,
  onRowFocus,
}: EntryTreeItemProps) {
  const tree = useContentTree();
  const navigate = useNavigate();
  const actions = useActionItems({ kind: "entry", node });
  const [dropAt, setDropAt] = useState<DropPosition | undefined>();
  const showsChildren = node.childCount > 0 && !node.childrenAsCollection;
  const { rememberNode } = tree;
  useEffect(() => rememberNode(node), [rememberNode, node]);
  const isExpanded = showsChildren && tree.expanded.has(node.id);
  const title = node.title || t("tree.untitled");

  function canDropHere(): boolean {
    const dragged = tree.dragged;
    return dragged !== undefined && dragged.id !== node.id;
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    if (!canDropHere()) return;
    const box = event.currentTarget.getBoundingClientRect();
    const position = dropPosition(event.clientY - box.top, box.height, true);
    // Beside a top-level entry means the top of that collection, which only its own kind can join.
    const joinsAnotherSection =
      position !== "inside" &&
      node.parentId === null &&
      tree.dragged?.collection.handle !== node.collection.handle;
    if (joinsAnotherSection) {
      setDropAt(undefined);
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropAt(position);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const dragged = tree.dragged;
    const position = dropAt;
    setDropAt(undefined);
    tree.setDragged(undefined);
    if (!dragged || !position || dragged.id === node.id) return;
    const target = moveForDrop(dragged.id, node, position, siblingIds);
    void tree.moveWithUndo(dragged, target.parentId, target.index);
  }

  return (
    <TreeRow
      treeKey={node.id}
      parentKey={parentKey}
      depth={depth}
      label={title}
      icon={iconForContent(node.collection, { isHome })}
      isSelected={tree.selectedKey === node.id}
      isTabStop={tabStopKey === node.id}
      onFocus={() => onRowFocus(node.id)}
      onOpen={() => {
        tree.clearSelection();
        void navigate({
          to: "/content/$collection/$entryId",
          params: { collection: node.collection.handle, entryId: node.id },
        });
      }}
      selecting={{
        isPicked: tree.selection.has(node.id),
        isActive: tree.selection.size > 0,
        onSelect: (gesture) => tree.selectNode(node, gesture),
        onExtendTo: (key) => tree.extendSelection(key, node.id),
      }}
      isExpandable={showsChildren}
      isExpanded={isExpanded}
      onToggle={showsChildren ? () => tree.toggle(node.id) : undefined}
      state={nodeState(node)}
      scheduledFor={node.scheduledFor}
      count={
        node.childrenAsCollection && node.childCount > 0
          ? {
              value: node.childCount,
              description: t("tree.childCount", { count: node.childCount }),
            }
          : undefined
      }
      actions={actions}
      drag={{
        draggable: tree.canUpdate,
        onDragStart: (event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", title);
          tree.setDragged(node);
        },
        onDragEnd: () => tree.setDragged(undefined),
        onDragOver: handleDragOver,
        onDragLeave: () => setDropAt(undefined),
        onDrop: handleDrop,
        dropIndicator: dropAt,
      }}
    >
      {isExpanded && (
        <TreeBranch
          place={{ parentId: node.id }}
          parentKey={node.id}
          depth={depth + 1}
          tabStopKey={tabStopKey}
          onRowFocus={onRowFocus}
        />
      )}
    </TreeRow>
  );
}
