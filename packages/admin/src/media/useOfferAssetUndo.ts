import { describeError } from "../api/describeError.js";
import { useToast } from "../design/Toast.js";
import { t } from "../i18n/strings.js";
import { type Asset, restoreAsset } from "./media.api.js";
import { useRefreshMediaBin } from "./media.queries.js";

/**
 * After a file went to the recycle bin: "Moved “logo.png” to the recycle bin. Undo", at the
 * foot of the window. Undo puts it back in the library with the same id, name and alt text.
 */
export function useOfferAssetUndo() {
  const showToast = useToast();
  const refresh = useRefreshMediaBin();

  return function offerUndo(asset: Pick<Asset, "id" | "filename">) {
    const name = asset.filename;

    async function undo() {
      try {
        await restoreAsset(asset.id);
        await refresh();
        showToast({ tone: "neutral", message: t("media.delete.undone", { name }) });
      } catch (error) {
        showToast({
          tone: "danger",
          message: t("media.delete.undoFailed", { name, reason: describeError(error) }),
        });
      }
    }

    showToast({
      tone: "neutral",
      message: t("media.delete.done", { name }),
      actions: [{ label: t("common.undo"), run: () => void undo() }],
    });
  };
}
