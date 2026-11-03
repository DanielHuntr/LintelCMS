import { describeError } from "../api/describeError.js";
import type { ToastNotice } from "../design/Toast.js";
import { t } from "../i18n/strings.js";
import { moveToRecycleBin, restoreFromRecycleBin } from "./contentTree.api.js";
import { useRefreshContent } from "./contentTree.queries.js";

interface RecycleOptions {
  /** Shows the note: the tree's, or the admin's for the entry editor. */
  notify: (notice: Omit<ToastNotice, "id">) => void;
  /** Runs once it's in the bin, before the note: leaving an editor that showed it, say. */
  afterRecycle?: (entryIds: string[]) => Promise<void>;
  /** Runs after Undo brought it back: opening it again, say. */
  afterUndo?: (entryId: string) => Promise<void>;
}

/**
 * Moves an entry, with everything under it, to the recycle bin and says so, with Undo:
 * "Moved “About” to the recycle bin. Undo". Undo puts it back as it was, in its old place,
 * and live again if it was live and the person may publish (`asBefore`, see core's
 * recycle-bin README). Throws when binning fails, for the caller to show where it asked.
 */
export function useRecycleWithUndo() {
  const refresh = useRefreshContent();

  return async function recycle(
    entryId: string,
    title: string,
    { notify, afterRecycle, afterUndo }: RecycleOptions,
  ): Promise<void> {
    const { itemId, entryIds } = await moveToRecycleBin(entryId);
    await refresh(entryIds);
    await afterRecycle?.(entryIds);

    async function undo() {
      try {
        const restored = await restoreFromRecycleBin(itemId, { asBefore: true });
        await refresh(entryIds);
        notify({ tone: "neutral", message: t("tree.delete.undone", { title }) });
        await afterUndo?.(restored.entryId);
      } catch (error) {
        notify({
          tone: "danger",
          message: t("tree.delete.undoFailed", { title, reason: describeError(error) }),
        });
      }
    }

    notify({
      tone: "neutral",
      message: t("tree.delete.done", { title }),
      actions: [{ label: t("common.undo"), run: () => void undo() }],
    });
  };
}
