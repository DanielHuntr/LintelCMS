import { useNavigate } from "@tanstack/react-router";
import { t } from "../i18n/strings.js";
import { restoreFromRecycleBin, runBulkAction } from "./contentTree.api.js";
import type { BatchResult } from "./contentTree.types.js";
import { useRefreshContent } from "./contentTree.queries.js";

export type BulkAction = "publish" | "unpublish" | "move" | "recycle";

/** What a bulk action did, in words, with Undo for a delete. */
export interface BulkOutcome {
  message: string;
  skipped: BatchResult["skipped"];
  undo?: { label: string; run: () => Promise<string> };
}

const doneMessages = {
  publish: "tree.selection.published",
  unpublish: "tree.selection.unpublished",
  move: "tree.selection.moved",
  recycle: "bulkDelete.done",
} as const;

/**
 * Runs a bulk action from the tree's selection bar or the list's, refreshes what changed,
 * and says what happened. A delete offers Undo, which brings every page back from the
 * recycle bin. When the workspace shows a page that was deleted, it goes back to Content.
 */
export function useBulkActions(selectedKey: string | undefined) {
  const refresh = useRefreshContent();
  const navigate = useNavigate();

  return async function run(
    action: BulkAction,
    entryIds: readonly string[],
    parentId?: string | null,
  ): Promise<BulkOutcome> {
    const result = await runBulkAction(action, [...entryIds], parentId);
    await refresh(result.changed);
    const message =
      result.changed.length === 0
        ? t("tree.selection.nothing")
        : t(doneMessages[action], { count: result.changed.length });
    if (action !== "recycle") return { message, skipped: result.skipped };

    if (selectedKey !== undefined && result.changed.includes(selectedKey)) {
      await navigate({ to: "/content", ignoreBlocker: true });
    }
    const itemIds = result.recycleBinItemIds ?? [];
    return {
      message,
      skipped: result.skipped,
      undo:
        itemIds.length === 0
          ? undefined
          : {
              label: t("bulkDelete.undo"),
              run: async () => {
                let restored = 0;
                for (const itemId of itemIds) {
                  restored += (await restoreFromRecycleBin(itemId)).restoredCount > 0 ? 1 : 0;
                }
                await refresh(result.changed);
                return t("bulkDelete.undone", { count: restored });
              },
            },
    };
  };
}
