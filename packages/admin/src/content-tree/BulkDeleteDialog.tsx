import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { summarizeBulk } from "./contentTree.api.js";
import type { TreeNode } from "./contentTree.types.js";
import { treeKeys } from "./contentTree.queries.js";

interface BulkDeleteDialogProps {
  nodes: readonly TreeNode[];
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

/**
 * One question before deleting several pages: which they are, how many pages sit inside
 * each, and that they go to the recycle bin (where they can be brought back).
 */
export function BulkDeleteDialog({ nodes, onConfirm, onClose }: BulkDeleteDialogProps) {
  const ids = nodes.map((node) => node.id);
  const summary = useQuery({
    queryKey: [...treeKeys.all(), "bulk-summary", ids],
    queryFn: () => summarizeBulk(ids),
  });
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const items = summary.data?.items ?? [];

  async function confirm() {
    setIsWorking(true);
    setError(null);
    try {
      await onConfirm();
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
      size="alert"
      onClose={onClose}
      title={t("bulkDelete.title", { count: summary.data?.items.length ?? nodes.length })}
      description={t("bulkDelete.intro")}
      footer={
        <>
          <Button variant="tinted" onClick={onClose} data-autofocus="">
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={() => void confirm()}
            disabled={isWorking || !summary.data}
          >
            {t("bulkDelete.confirm")}
          </Button>
        </>
      }
    >
      {summary.isPending && (
        <LoadingRegion label={t("bulkDelete.loading")}>
          <Skeleton className="h-16 w-full" />
        </LoadingRegion>
      )}
      {summary.data && (
        <>
          <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-control bg-fill/50 px-3 py-2 text-start text-footnote">
            {items.map((item) => (
              <li key={item.id} className="flex items-baseline gap-2">
                <span className="min-w-0 truncate font-medium text-label">
                  {item.title || t("tree.untitled")}
                </span>
                {item.descendantCount > 0 && (
                  <span className="shrink-0 text-label-secondary">
                    {t("bulkDelete.under", { count: item.descendantCount })}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-footnote text-label-secondary">
            {t("bulkDelete.total", { count: summary.data.totalCount })}
          </p>
        </>
      )}
      {(error || summary.isError) && (
        <p role="alert" className="mt-2 text-footnote text-danger">
          {error ?? describeError(summary.error)}
        </p>
      )}
    </Dialog>
  );
}
