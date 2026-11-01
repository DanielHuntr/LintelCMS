import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useState } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { getTreeChildren, sortChildren } from "./contentTree.api.js";
import type { TreeNode, TreePlace } from "./contentTree.types.js";
import { useRefreshContent } from "./contentTree.queries.js";
import { movedItem } from "./sortOrder.js";

/** The most the dialog sorts at once; what comes after keeps its order. */
const SORT_LIMIT = 200;

interface SortDialogProps {
  place: TreePlace;
  placeName: string;
  onClose: () => void;
}

/**
 * "Sort children": the items at one place, in order, with buttons to move each one up or
 * down (and "Sort A to Z"), saved together. Works the same with a keyboard as with a mouse.
 */
export function SortDialog({ place, placeName, onClose }: SortDialogProps) {
  const refresh = useRefreshContent();
  const children = useQuery({
    queryKey: ["content-tree", "sorting", place],
    queryFn: () => getTreeChildren(place, { offset: 0, limit: SORT_LIMIT }),
  });
  const [order, setOrder] = useState<TreeNode[] | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const items = order ?? children.data?.items ?? [];

  function move(index: number, offset: -1 | 1) {
    const next = movedItem(items, index, offset);
    const item = next[index + offset];
    if (!item) return;
    setOrder(next);
    setAnnouncement(
      t("tree.sort.moved", {
        title: item.title || t("tree.untitled"),
        position: index + offset + 1,
        count: next.length,
      }),
    );
  }

  async function save() {
    setIsWorking(true);
    setError(null);
    try {
      await sortChildren(
        "parentId" in place ? place.parentId : null,
        "collection" in place ? place.collection : undefined,
        items.map((item) => item.id),
      );
      await refresh();
      onClose();
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("tree.sort.title", { place: placeName })}
      description={t("tree.sort.description")}
      footer={
        <>
          <Button
            variant="plain"
            onClick={() =>
              setOrder(
                [...items].sort((first, second) =>
                  first.title.localeCompare(second.title, undefined, { sensitivity: "base" }),
                ),
              )
            }
          >
            {t("tree.sort.alphabetical")}
          </Button>
          <span className="flex-1" />
          <Button variant="plain" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void save()} disabled={isWorking || order === null}>
            {t("tree.sort.confirm")}
          </Button>
        </>
      }
    >
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {children.isPending && <Skeleton className="h-24 w-full" />}
      {children.data && children.data.total > SORT_LIMIT && (
        <p className="mb-2 text-footnote text-label-secondary">
          {t("tree.sort.tooMany", { count: SORT_LIMIT })}
        </p>
      )}
      <ol className="flex flex-col">
        {items.map((item, index) => {
          const title = item.title || t("tree.untitled");
          return (
            <li
              key={item.id}
              className="flex h-10 items-center gap-2 hairline-top first:border-t-0"
            >
              <span className="w-6 text-right text-caption text-label-tertiary tabular-nums">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-body text-label">{title}</span>
              <Button
                variant="plain"
                size="small"
                aria-label={t("tree.sort.up", { title })}
                disabled={index === 0}
                onClick={() => move(index, -1)}
                icon={<ArrowUp aria-hidden="true" />}
              />
              <Button
                variant="plain"
                size="small"
                aria-label={t("tree.sort.down", { title })}
                disabled={index === items.length - 1}
                onClick={() => move(index, 1)}
                icon={<ArrowDown aria-hidden="true" />}
              />
            </li>
          );
        })}
      </ol>
      {error && (
        <p role="alert" className="mt-2 text-footnote text-danger">
          {error}
        </p>
      )}
    </Dialog>
  );
}
