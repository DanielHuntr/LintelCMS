import { useState } from "react";
import { describeError } from "../api/describeError.js";
import { describeResult } from "../content-tree/BranchActionDialog.js";
import { runBulkAction } from "../content-tree/contentTree.api.js";
import type { BatchResult, TreeNode } from "../content-tree/contentTree.types.js";
import { useRefreshContent } from "../content-tree/contentTree.queries.js";
import { MoveDialog } from "../content-tree/MoveDialog.js";
import { Button } from "../design/Button.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { t, tCount } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";

interface BulkActionBarProps {
  nodes: readonly TreeNode[];
  /** Called after an action, to clear the selection. */
  onDone: () => void;
}

/**
 * What can be done to the selected rows of the collection view at once, and what the last
 * action did (it stays after the selection is cleared).
 */
export function BulkActionBar({ nodes, onDone }: BulkActionBarProps) {
  const refresh = useRefreshContent();
  const canPublish = useCan("entries:publish");
  const canUpdate = useCan("entries:update");
  const canDelete = useCan("entries:delete");
  const [asking, setAsking] = useState<"move" | "delete" | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [outcome, setOutcome] = useState<{ text: string; skipped: BatchResult["skipped"] } | null>(
    null,
  );
  const ids = nodes.map((node) => node.id);

  async function run(
    action: "publish" | "unpublish" | "move" | "recycle",
    parentId?: string | null,
  ) {
    setIsWorking(true);
    try {
      const result = await runBulkAction(action, ids, parentId);
      await refresh(result.changed);
      setOutcome({ text: describeResult(result), skipped: result.skipped });
      setAsking(null);
      onDone();
    } catch (error) {
      setOutcome({ text: describeError(error), skipped: [] });
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 empty:hidden">
      {nodes.length > 0 && (
        <div
          role="toolbar"
          aria-label={t("collectionView.selected", { count: nodes.length })}
          className="flex flex-wrap items-center gap-2 rounded-card bg-accent/10 px-3 py-2"
        >
          <span className="text-footnote font-medium text-label">
            {t("collectionView.selected", { count: nodes.length })}
          </span>
          <span className="flex-1" />
          {canPublish && (
            <>
              <Button
                size="small"
                variant="tinted"
                disabled={isWorking}
                onClick={() => void run("publish")}
              >
                {t("collectionView.bulkPublish")}
              </Button>
              <Button
                size="small"
                variant="tinted"
                disabled={isWorking}
                onClick={() => void run("unpublish")}
              >
                {t("collectionView.bulkUnpublish")}
              </Button>
            </>
          )}
          {canUpdate && (
            <Button
              size="small"
              variant="tinted"
              disabled={isWorking}
              onClick={() => setAsking("move")}
            >
              {t("collectionView.bulkMove")}
            </Button>
          )}
          {canDelete && (
            <Button
              size="small"
              variant="destructive"
              disabled={isWorking}
              onClick={() => setAsking("delete")}
            >
              {t("collectionView.bulkDelete")}
            </Button>
          )}
          <Button size="small" variant="plain" onClick={onDone}>
            {t("collectionView.clearSelection")}
          </Button>
        </div>
      )}
      <div role="status" className="text-footnote text-label-secondary empty:hidden">
        {outcome && (
          <>
            <p>{outcome.text}</p>
            {outcome.skipped.length > 0 && (
              <ul className="mt-1 list-disc pl-5">
                {outcome.skipped.map((skipped) => (
                  <li key={skipped.id}>
                    {t("tree.result.skipped", {
                      title: skipped.title || t("tree.untitled"),
                      reason: skipped.reason,
                    })}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
      {asking === "move" && (
        <MoveDialog
          nodes={nodes}
          onMove={(parentId) => run("move", parentId)}
          onClose={() => setAsking(null)}
        />
      )}
      <ConfirmDialog
        open={asking === "delete"}
        title={tCount(
          { one: "collectionView.bulkDeleteTitleOne", other: "collectionView.bulkDeleteTitle" },
          nodes.length,
        )}
        message={t("collectionView.bulkDeleteMessage")}
        confirmLabel={t("tree.delete.confirm")}
        cancelLabel={t("common.cancel")}
        isDestructive
        isWorking={isWorking}
        onCancel={() => setAsking(null)}
        onConfirm={() => void run("recycle")}
      />
    </div>
  );
}
