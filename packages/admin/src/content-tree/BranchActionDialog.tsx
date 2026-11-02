import { useNavigate } from "@tanstack/react-router";
import { useId, useState } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { t, type StringKey } from "../i18n/strings.js";
import {
  duplicateBranch,
  moveToRecycleBin,
  publishBranch,
  runBulkAction,
  unpublishBranch,
} from "./contentTree.api.js";
import type { BatchResult, TreeNode } from "./contentTree.types.js";
import { useRefreshContent } from "./contentTree.queries.js";
import type { TreeNotice } from "./TreeToast.js";
import { useUnpublishedParentQuestion } from "./useUnpublishedParentQuestion.js";

export type BranchAction = "publish" | "unpublish" | "duplicate" | "delete";

const words: Record<
  BranchAction,
  { title: StringKey; message: StringKey; withChildren?: StringKey; confirm: StringKey }
> = {
  publish: {
    title: "tree.publish.title",
    message: "tree.publish.message",
    withChildren: "tree.publish.withChildren",
    confirm: "tree.publish.confirm",
  },
  unpublish: {
    title: "tree.unpublish.title",
    message: "tree.unpublish.message",
    withChildren: "tree.unpublish.withChildren",
    confirm: "tree.unpublish.confirm",
  },
  duplicate: {
    title: "tree.duplicate.title",
    message: "tree.duplicate.message",
    withChildren: "tree.duplicate.withChildren",
    confirm: "tree.duplicate.confirm",
  },
  delete: {
    title: "tree.delete.title",
    message: "tree.delete.message",
    confirm: "tree.delete.confirm",
  },
};

interface BranchActionDialogProps {
  action: BranchAction;
  node: TreeNode;
  /** The entry the workspace shows, so deleting it (or what it's under) leaves the workspace. */
  selectedKey: string | undefined;
  onClose: () => void;
  onNotice: (notice: Omit<TreeNotice, "id">) => void;
}

/**
 * Asks before acting on an entry, in plain words, and offers to include everything under it.
 * Publishing reports anything that couldn't go live (a required field left empty, say).
 */
export function BranchActionDialog({
  action,
  node,
  selectedKey,
  onClose,
  onNotice,
}: BranchActionDialogProps) {
  const navigate = useNavigate();
  const refresh = useRefreshContent();
  const checkboxId = useId();
  const parentQuestion = useUnpublishedParentQuestion();
  const [includeChildren, setIncludeChildren] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BatchResult | null>(null);
  const title = node.title || t("tree.untitled");
  const text = words[action];
  const offersChildren = text.withChildren !== undefined && node.childCount > 0;
  const message =
    action === "delete" && node.childCount > 0
      ? t("tree.delete.messageWithChildren", { count: node.childCount })
      : t(text.message, { title });

  async function confirm() {
    setIsWorking(true);
    setError(null);
    const withChildren = offersChildren && includeChildren;
    try {
      if (action === "publish" || action === "unpublish") {
        // Under a page that isn't live, ask first, as the editor does (LINTEL-LEFT-005).
        const above = action === "publish" ? await parentQuestion.ask([node]) : [];
        if (above === null) {
          onClose();
          return;
        }
        const first = above.length > 0 ? await runBulkAction("publish", above) : null;
        const branch = await (action === "publish" ? publishBranch : unpublishBranch)(
          node.id,
          withChildren,
        );
        const done: BatchResult = {
          changed: [...(first?.changed ?? []), ...branch.changed],
          skipped: [...(first?.skipped ?? []), ...branch.skipped],
        };
        await refresh(done.changed);
        if (done.skipped.length > 0) {
          setResult(done);
          return;
        }
        onNotice({ tone: "neutral", message: describeResult(done) });
      } else if (action === "duplicate") {
        const { entry } = await duplicateBranch(node.id, withChildren);
        await refresh();
        onClose();
        await navigate({
          to: "/content/$collection/$entryId",
          params: { collection: entry.collectionHandle, entryId: entry.id },
        });
        return;
      } else {
        const { entryIds } = await moveToRecycleBin(node.id);
        await refresh(entryIds);
        if (selectedKey !== undefined && entryIds.includes(selectedKey)) {
          await navigate({ to: "/content", ignoreBlocker: true });
        }
        onNotice({ tone: "neutral", message: t("tree.delete.done", { title }) });
      }
      onClose();
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setIsWorking(false);
    }
  }

  if (result) {
    return (
      <Dialog
        open
        size="alert"
        onClose={onClose}
        title={describeResult(result)}
        footer={<Button onClick={onClose}>{t("common.done")}</Button>}
      >
        <p className="text-footnote text-label-secondary">{t("tree.result.skippedHeading")}</p>
        <ul className="mt-2 flex flex-col gap-1.5 text-start text-footnote text-label">
          {result.skipped.map((skipped) => (
            <li key={skipped.id}>
              {t("tree.result.skipped", {
                title: skipped.title || t("tree.untitled"),
                reason: skipped.reason,
              })}
            </li>
          ))}
        </ul>
      </Dialog>
    );
  }

  if (parentQuestion.dialog) return parentQuestion.dialog;

  return (
    <Dialog
      open
      size="alert"
      onClose={onClose}
      title={t(text.title, { title })}
      description={message}
      footer={
        <>
          <Button variant="tinted" onClick={onClose} data-autofocus="">
            {t("common.cancel")}
          </Button>
          <Button
            variant={action === "delete" ? "destructive" : "filled"}
            onClick={() => void confirm()}
            disabled={isWorking}
          >
            {t(text.confirm)}
          </Button>
        </>
      }
    >
      {offersChildren && text.withChildren && (
        <label
          htmlFor={checkboxId}
          className="flex items-center gap-2 text-start text-footnote text-label"
        >
          <input
            id={checkboxId}
            type="checkbox"
            checked={includeChildren}
            onChange={(event) => setIncludeChildren(event.target.checked)}
            className="size-4 accent-(--color-accent-fill)"
          />
          {t(text.withChildren, { count: node.childCount })}
        </label>
      )}
      {error && (
        <p role="alert" className="mt-2 text-footnote text-danger">
          {error}
        </p>
      )}
    </Dialog>
  );
}

export function describeResult(result: BatchResult): string {
  if (result.changed.length === 0) return t("tree.result.nothing");
  return result.changed.length === 1
    ? t("tree.result.changedOne")
    : t("tree.result.changed", { count: result.changed.length });
}
