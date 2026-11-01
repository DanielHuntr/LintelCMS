import { CircleAlert, FileText } from "lucide-react";
import { useId } from "react";
import { ApiError } from "../api/client.js";
import { Button } from "../design/Button.js";
import { t } from "../i18n/strings.js";
import type { Asset, AssetUsage } from "./media.api.js";
import { useDeleteAsset } from "./media.queries.js";
import { Modal } from "./Modal.js";

interface DeleteAssetDialogProps {
  asset: Asset;
  onCancel: () => void;
  onDeleted: () => void;
}

/**
 * Asks before deleting, because it can't be undone. If entries still use the file, the API
 * refuses and this lists them, so the editor knows exactly what to change first.
 */
export function DeleteAssetDialog({ asset, onCancel, onDeleted }: DeleteAssetDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const deletion = useDeleteAsset();
  const usedBy = usageFrom(deletion.error);
  const otherError = deletion.error && !usedBy ? deletion.error.message : undefined;

  function confirmDelete() {
    deletion.mutate(asset.id, { onSuccess: onDeleted });
  }

  return (
    <Modal size="alert" labelledBy={titleId} describedBy={descriptionId} onClose={onCancel}>
      <div className="flex flex-col gap-4 p-6">
        <span
          className={`flex size-11 items-center justify-center rounded-full ${usedBy ? "bg-warning/14 text-warning" : "bg-danger/12 text-danger"}`}
        >
          <CircleAlert aria-hidden="true" strokeWidth={1.75} className="size-6" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h2 id={titleId} className="text-headline text-label">
            {usedBy
              ? t("media.delete.inUseTitle")
              : t("media.delete.confirmTitle", { name: asset.filename })}
          </h2>
          <p id={descriptionId} className="text-body text-label-secondary">
            {usedBy ? t("media.delete.inUseDescription") : t("media.delete.confirmDescription")}
          </p>
        </div>

        {usedBy && (
          <section aria-label={t("media.delete.usedIn")} className="rounded-card bg-fill px-3 py-1">
            <h3 className="sr-only">{t("media.delete.usedIn")}</h3>
            <ul>
              {usedBy.map((usage) => (
                <li
                  key={usage.entryId}
                  className="flex items-center gap-2.5 py-2 text-body text-label not-first:hairline-top"
                >
                  <FileText aria-hidden="true" className="size-4 shrink-0 text-label-secondary" />
                  <span className="truncate">{usage.title}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {otherError && (
          <p role="alert" className="text-footnote text-danger">
            {otherError}
          </p>
        )}

        <div className="mt-1 flex justify-end gap-2">
          {/* First in the dialog, so it has focus when the dialog opens: the safe choice. */}
          <Button variant="plain" onClick={onCancel}>
            {t("media.delete.cancel")}
          </Button>
          {!usedBy && (
            <Button
              // The design system has no destructive button yet; this one is red, like macOS's.
              className="bg-danger! text-on-accent"
              onClick={confirmDelete}
              disabled={deletion.isPending}
            >
              {deletion.isPending ? t("media.delete.deleting") : t("media.delete.confirm")}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function usageFrom(error: Error | null): AssetUsage[] | undefined {
  if (!(error instanceof ApiError) || error.code !== "ASSET_IN_USE") return undefined;
  const usedBy = error.details.usedBy;
  return Array.isArray(usedBy) ? (usedBy as AssetUsage[]) : [];
}
