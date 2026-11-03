import { useId, useState } from "react";
import { Button } from "../design/Button.js";
import { classNames } from "../design/classNames.js";
import { Dialog } from "../design/Dialog.js";
import { SearchField } from "../design/SearchField.js";
import { t } from "../i18n/strings.js";
import { useDebouncedValue } from "../media/useDebouncedValue.js";
import { useContentTree } from "./ContentTreeContext.js";
import type { TreeNode } from "./contentTree.types.js";
import { useMoveTargets, useTreeSearch } from "./contentTree.queries.js";
import { iconForContent } from "./typeIcons.js";

interface MoveDialogProps {
  /** What is moving: one entry from the tree, or several from the collection view. */
  nodes: readonly TreeNode[];
  onMove: (parentId: string | null) => void | Promise<void>;
  onClose: () => void;
}

/**
 * "Move…": the keyboard-friendly way to do what dragging does. Find a page to put it under,
 * or pick the top of its own section. The server checks the content types allow it.
 */
export function MoveDialog({ nodes, onMove, onClose }: MoveDialogProps) {
  const { siteId } = useContentTree();
  const [search, setSearch] = useState("");
  const settled = useDebouncedValue(search.trim(), 250);
  const results = useTreeSearch(settled, siteId);
  const first = nodes[0];
  // Before anything is typed, the tree's own pages are listed, so there is something to pick.
  const browsing = useMoveTargets(
    first?.collection.handle ?? "",
    siteId,
    settled === "" && !!first,
  );
  const [choice, setChoice] = useState<string | null | undefined>(undefined);
  const [isWorking, setIsWorking] = useState(false);
  const groupName = useId();
  const moving = new Set(nodes.map((node) => node.id));
  const candidates: { node: TreeNode; depth: number }[] = (
    settled === ""
      ? (browsing.data ?? [])
      : (results.data?.items ?? []).map((node) => ({ node, depth: 0 }))
  ).filter(({ node }) => !moving.has(node.id));
  const title =
    nodes.length === 1 && first
      ? t("tree.move.title", { title: first.title || t("tree.untitled") })
      : t("collectionView.bulkMoveTitle", { count: nodes.length });

  async function confirm() {
    if (choice === undefined) return;
    setIsWorking(true);
    try {
      await onMove(choice);
      onClose();
    } finally {
      setIsWorking(false);
    }
  }

  const option = (value: string | null, label: string, node?: TreeNode, depth = 0) => {
    const Icon = iconForContent(node?.collection ?? first?.collection ?? { handle: "" });
    return (
      <label
        key={value ?? "top"}
        className={classNames(
          "flex cursor-pointer items-center gap-2.5 rounded-control px-3 py-2 text-body has-focus-visible:focus-ring",
          choice === value ? "bg-accent/12 text-accent" : "text-label hover:bg-fill",
          depth > 0 && "ps-8",
        )}
      >
        <input
          type="radio"
          name={groupName}
          checked={choice === value}
          onChange={() => setChoice(value)}
          className="sr-only"
        />
        <Icon aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {node && <span className="text-caption text-label-tertiary">{node.collection.name}</span>}
      </label>
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      description={t("tree.move.description")}
      footer={
        <>
          <Button variant="plain" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void confirm()} disabled={choice === undefined || isWorking}>
            {t("tree.move.confirm")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <SearchField
          label={t("tree.move.search")}
          value={search}
          onValueChange={setSearch}
          data-autofocus=""
        />
        <div role="radiogroup" aria-label={title} className="flex flex-col gap-0.5">
          {first && option(null, t("tree.move.top", { collection: first.collection.name }))}
          {candidates.map(({ node, depth }) =>
            option(node.id, node.title || t("tree.untitled"), node, depth),
          )}
        </div>
      </div>
    </Dialog>
  );
}
