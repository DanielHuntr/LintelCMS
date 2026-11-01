import type { FocalPoint } from "@lintel/core/media-crop";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { t } from "../i18n/strings.js";
import { AssetActions } from "./AssetActions.js";
import { AssetDetailsList } from "./AssetDetailsList.js";
import { AssetPreview } from "./AssetPreview.js";
import { AltTextField } from "./AltTextField.js";
import { CropPreviews } from "./CropPreviews.js";
import { TextField } from "../design/TextField.js";
import { type Asset, type AssetChanges, isImage } from "./media.api.js";
import { useUpdateAsset } from "./media.queries.js";
import { Modal } from "./Modal.js";

interface AssetDetailSheetProps {
  asset: Asset;
  onClose: () => void;
  /** Step through the library without closing, like arrowing through Photos. */
  onPrevious?: () => void;
  onNext?: () => void;
  canUpdate: boolean;
  canDelete: boolean;
}

/** Waits for the point to settle before saving, so arrowing across the image is one save. */
const FOCAL_POINT_SAVE_DELAY = 500;

/**
 * Everything about one file: a large preview with the focal point picker, its alt text and
 * name, how it crops, its details, and copying, downloading or deleting it. Changes save as
 * they are made, as in Apple's apps, with "Saved" confirming each one.
 */
export function AssetDetailSheet({
  asset,
  onClose,
  onPrevious,
  onNext,
  canUpdate,
  canDelete,
}: AssetDetailSheetProps) {
  const titleId = useId();
  const update = useUpdateAsset();
  const [focalPoint, setFocalPoint] = useState(asset.focalPoint);
  const [alt, setAlt] = useState(asset.alt);
  const [filename, setFilename] = useState(asset.filename);
  const focalSaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const unsavedFocalPoint = useRef<FocalPoint | undefined>(undefined);
  const image = isImage(asset);
  const aspectRatio = asset.width && asset.height ? asset.width / asset.height : 1;

  function save(changes: AssetChanges) {
    update.mutate({ assetId: asset.id, changes });
  }

  function saveFocalPointNow() {
    clearTimeout(focalSaveTimer.current);
    const point = unsavedFocalPoint.current;
    unsavedFocalPoint.current = undefined;
    if (point) save({ focalPoint: point });
  }

  function saveFocalPointSoon(point: FocalPoint) {
    unsavedFocalPoint.current = point;
    clearTimeout(focalSaveTimer.current);
    focalSaveTimer.current = setTimeout(saveFocalPointNow, FOCAL_POINT_SAVE_DELAY);
  }

  // Closing the sheet (or moving to the next file) straight after moving the focal point
  // saves it then, rather than dropping it.
  const { mutate } = update;
  const assetId = asset.id;
  useEffect(() => {
    const timer = focalSaveTimer;
    const unsaved = unsavedFocalPoint;
    return () => {
      clearTimeout(timer.current);
      if (unsaved.current) mutate({ assetId, changes: { focalPoint: unsaved.current } });
    };
  }, [mutate, assetId]);

  function saveAltIfChanged() {
    if (alt.trim() !== asset.alt) save({ alt: alt.trim() });
  }

  function saveFilenameIfChanged() {
    const trimmed = filename.trim();
    if (!trimmed) {
      setFilename(asset.filename);
    } else if (trimmed !== asset.filename) {
      update.mutate(
        { assetId: asset.id, changes: { filename: trimmed } },
        // The API keeps the real extension, so show the name it settled on.
        { onSuccess: (saved) => setFilename(saved.filename) },
      );
    }
  }

  return (
    <Modal size="sheet" labelledBy={titleId} onClose={onClose}>
      <header className="flex h-14 shrink-0 items-center gap-3 px-4 hairline-bottom">
        <div className="flex items-center gap-1">
          <IconButton label={t("media.detail.previous")} onClick={onPrevious} icon={ChevronLeft} />
          <IconButton label={t("media.detail.next")} onClick={onNext} icon={ChevronRight} />
        </div>
        <h2 id={titleId} className="min-w-0 flex-1 truncate text-headline text-label">
          {asset.filename}
        </h2>
        <SaveStatus status={update.status} error={update.error?.message} />
        <IconButton label={t("media.detail.close")} onClick={onClose} icon={X} />
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-h-0 bg-background p-8">
          <AssetPreview
            asset={asset}
            focalPoint={focalPoint}
            aspectRatio={aspectRatio}
            canUpdate={canUpdate}
            onFocalPointChange={setFocalPoint}
            onFocalPointCommit={saveFocalPointSoon}
          />
        </div>

        <div className="flex min-h-0 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
            {image && (
              <AltTextField
                label={t("media.detail.alt.label")}
                hint={t("media.detail.alt.hint")}
                value={alt}
                disabled={!canUpdate}
                maxLength={1000}
                onChange={(event) => setAlt(event.target.value)}
                onBlur={saveAltIfChanged}
              />
            )}
            <TextField
              label={t("media.detail.filename.label")}
              value={filename}
              disabled={!canUpdate}
              maxLength={200}
              onChange={(event) => setFilename(event.target.value)}
              onBlur={saveFilenameIfChanged}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
            {image && asset.thumbnailUrl && (
              <CropPreviews
                imageUrl={asset.thumbnailUrl}
                aspectRatio={aspectRatio}
                focalPoint={focalPoint}
              />
            )}
            <AssetDetailsList asset={asset} />
          </div>
          <footer className="shrink-0 px-6 py-4 hairline-top">
            <AssetActions asset={asset} canDelete={canDelete} onDeleted={onClose} />
          </footer>
        </div>
      </div>
    </Modal>
  );
}

function SaveStatus({ status, error }: { status: string; error: string | undefined }) {
  const text =
    status === "pending"
      ? t("media.detail.saving")
      : status === "success"
        ? t("media.detail.saved")
        : status === "error"
          ? t("media.detail.saveFailed", { message: error ?? "" })
          : "";
  return (
    <p
      role="status"
      className={`max-w-[50%] truncate text-footnote ${status === "error" ? "text-danger" : "text-label-secondary"}`}
    >
      {text}
    </p>
  );
}

function IconButton({
  label,
  onClick,
  icon: Icon,
}: {
  label: string;
  onClick: (() => void) | undefined;
  icon: typeof X;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={!onClick}
      className="flex size-8 items-center justify-center rounded-full text-label-secondary transition-colors duration-150 ease-standard hover:bg-fill hover:text-label focus-visible:focus-ring disabled:opacity-30"
    >
      <Icon aria-hidden="true" strokeWidth={2} className="size-[18px]" />
    </button>
  );
}
