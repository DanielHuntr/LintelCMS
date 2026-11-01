import { useState } from "react";
import { describeError } from "../api/describeError.js";
import { BulkDeleteDialog } from "../content-tree/BulkDeleteDialog.js";
import type { TreeNode } from "../content-tree/contentTree.types.js";
import { MoveDialog } from "../content-tree/MoveDialog.js";
import {
  type BulkAction,
  type BulkOutcome,
  useBulkActions,
} from "../content-tree/useBulkActions.js";
import { Button } from "../design/Button.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";

interface BulkActionBarProps {
  nodes: readonly TreeNode[];
  /** The entry the workspace shows, so deleting it goes back to Content. */
  selectedKey?: string;
  /** Called after an action, to clear the selection. */
  onDone: () => void;
}

/**
 * What can be done to the selected rows of the collection view at once, and what the last
 * action did (it stays after the selection is cleared), with Undo after a delete.
 */
export function BulkActionBar({ nodes, selectedKey, onDone }: BulkActionBarProps) {
  const run = useBulkActions(selectedKey);
  const canPublish = useCan("entries:publish");
  const canUpdate = useCan("entries:update");
  const canDelete = useCan("entries:delete");
  const [asking, setAsking] = useState<"move" | "delete" | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [outcome, setOutcome] = useState<BulkOutcome | null>(null);
  const ids = nodes.map((node) => node.id);

  async function act(action: BulkAction, parentId?: string | null) {
    setIsWorking(true);
    try {
      setOutcome(await run(action, ids, parentId));
      setAsking(null);
      onDone();
    } catch (error) {
      setOutcome({ message: describeError(error), skipped: [] });
    } finally {
      setIsWorking(false);
    }
  }

  async function undo() {
    const undoing = outcome?.undo;
    if (!undoing) return;
    try {
      setOutcome({ message: await undoing.run(), skipped: [] });
    } catch (error) {
      setOutcome({ message: describeError(error), skipped: [] });
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
                onClick={() => void act("publish")}
              >
                {t("collectionView.bulkPublish")}
              </Button>
              <Button
                size="small"
                variant="tinted"
                disabled={isWorking}
                onClick={() => void act("unpublish")}
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
            <p className="flex flex-wrap items-center gap-2">
              {outcome.message}
              {outcome.undo && (
                <Button size="small" variant="plain" onClick={() => void undo()}>
                  {outcome.undo.label}
                </Button>
              )}
            </p>
            {outcome.skipped.length > 0 && (
              <ul className="mt-1 list-disc ps-5">
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
          onMove={(parentId) => act("move", parentId)}
          onClose={() => setAsking(null)}
        />
      )}
      {asking === "delete" && (
        <BulkDeleteDialog
          nodes={nodes}
          onConfirm={() => act("recycle")}
          onClose={() => setAsking(null)}
        />
      )}
    </div>
  );
}
