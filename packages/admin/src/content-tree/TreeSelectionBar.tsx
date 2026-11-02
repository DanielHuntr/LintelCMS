import { EyeOff, FolderInput, Send, Trash2, X } from "lucide-react";
import { useState } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { BulkDeleteDialog } from "./BulkDeleteDialog.js";
import { useContentTree } from "./ContentTreeContext.js";
import { MoveDialog } from "./MoveDialog.js";
import { type BulkAction, type BulkOutcome, useBulkActions } from "./useBulkActions.js";
import { useUnpublishedParentQuestion } from "./useUnpublishedParentQuestion.js";

/**
 * Along the bottom of the tree while pages are picked: how many, and what can be done to
 * them all at once. What happened is said in the tree's note, with Undo after a delete;
 * anything that couldn't be done (a page not ready to publish) is listed in a dialog.
 */
export function TreeSelectionBar() {
  const tree = useContentTree();
  const run = useBulkActions(tree.selectedKey);
  const parentQuestion = useUnpublishedParentQuestion();
  const canPublish = useCan("entries:publish");
  const canUpdate = useCan("entries:update");
  const canDelete = useCan("entries:delete");
  const [asking, setAsking] = useState<"move" | "delete" | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [skipped, setSkipped] = useState<BulkOutcome["skipped"]>([]);
  const nodes = tree.selectedNodes;
  if (nodes.length === 0 && skipped.length === 0) return null;

  async function act(action: BulkAction, parentId?: string | null) {
    setIsWorking(true);
    try {
      // Under pages that aren't live, ask first, as the editor does (LINTEL-LEFT-005).
      const above = action === "publish" ? await parentQuestion.ask(nodes) : [];
      if (above === null) return;
      const outcome = await run(action, [...above, ...nodes.map((node) => node.id)], parentId);
      tree.clearSelection();
      setAsking(null);
      if (outcome.skipped.length > 0) setSkipped(outcome.skipped);
      const undo = outcome.undo;
      tree.notify({
        tone: "neutral",
        message: outcome.message,
        actions: undo
          ? [
              {
                label: undo.label,
                run: () =>
                  void undo
                    .run()
                    .then((message) => tree.notify({ tone: "neutral", message }))
                    .catch((error: unknown) =>
                      tree.notify({ tone: "danger", message: describeError(error) }),
                    ),
              },
            ]
          : [],
      });
    } catch (error) {
      setAsking(null);
      tree.notify({ tone: "danger", message: describeError(error) });
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <>
      {nodes.length > 0 && (
        <div
          role="toolbar"
          aria-label={t("tree.selection.toolbar", { count: nodes.length })}
          className="hairline-top flex flex-col gap-2 bg-accent/8 px-2.5 py-2"
        >
          <div className="flex items-center gap-2 px-1">
            <span className="flex-1 text-footnote font-semibold text-label" aria-live="polite">
              {t("tree.selection.count", { count: nodes.length })}
            </span>
            <button
              type="button"
              onClick={tree.clearSelection}
              className="flex h-7 items-center gap-1 rounded-full px-2 text-footnote text-label-secondary hover:bg-fill hover:text-label focus-visible:focus-ring"
            >
              <X aria-hidden="true" strokeWidth={2} className="size-3.5" />
              {t("tree.selection.clear")}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {canPublish && (
              <>
                <Button
                  size="small"
                  variant="tinted"
                  icon={<Send aria-hidden="true" />}
                  disabled={isWorking}
                  onClick={() => void act("publish")}
                >
                  {t("tree.selection.publish")}
                </Button>
                <Button
                  size="small"
                  variant="tinted"
                  icon={<EyeOff aria-hidden="true" />}
                  disabled={isWorking}
                  onClick={() => void act("unpublish")}
                >
                  {t("tree.selection.unpublish")}
                </Button>
              </>
            )}
            {canUpdate && (
              <Button
                size="small"
                variant="tinted"
                icon={<FolderInput aria-hidden="true" />}
                disabled={isWorking}
                onClick={() => setAsking("move")}
              >
                {t("tree.selection.move")}
              </Button>
            )}
            {canDelete && (
              <Button
                size="small"
                variant="destructive"
                icon={<Trash2 aria-hidden="true" />}
                disabled={isWorking}
                onClick={() => setAsking("delete")}
              >
                {t("tree.selection.delete")}
              </Button>
            )}
          </div>
          <p className="px-1 text-caption text-label-tertiary">{t("tree.selection.hint")}</p>
        </div>
      )}
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
      {parentQuestion.dialog}
      {skipped.length > 0 && (
        <Dialog
          open
          size="alert"
          onClose={() => setSkipped([])}
          title={t("tree.selection.someSkipped", { count: skipped.length })}
          footer={<Button onClick={() => setSkipped([])}>{t("common.done")}</Button>}
        >
          <ul className="flex flex-col gap-1.5 text-start text-footnote text-label">
            {skipped.map((item) => (
              <li key={item.id}>
                {t("tree.result.skipped", {
                  title: item.title || t("tree.untitled"),
                  reason: item.reason,
                })}
              </li>
            ))}
          </ul>
        </Dialog>
      )}
    </>
  );
}
