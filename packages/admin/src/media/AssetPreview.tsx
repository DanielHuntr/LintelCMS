import type { FocalPoint } from "@lintel/core/media-crop";
import { FileText } from "lucide-react";
import { t } from "../i18n/strings.js";
import { FocalPointPicker } from "./FocalPointPicker.js";
import { fileKindLabel, formatFileSize } from "./formatting.js";
import { type Asset, assetImageUrl, isImage } from "./media.api.js";

interface AssetPreviewProps {
  asset: Asset;
  focalPoint: FocalPoint;
  aspectRatio: number;
  canUpdate: boolean;
  onFocalPointChange: (point: FocalPoint) => void;
  onFocalPointCommit: (point: FocalPoint) => void;
}

/** Large enough to fill the preview on a retina screen without fetching the full original. */
const PREVIEW_WIDTH = 1600;

/** The big picture in the detail sheet: the focal point picker for images, a large icon for documents. */
export function AssetPreview({
  asset,
  focalPoint,
  aspectRatio,
  canUpdate,
  onFocalPointChange,
  onFocalPointCommit,
}: AssetPreviewProps) {
  if (!isImage(asset)) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-3 text-label-secondary">
        <FileText aria-hidden="true" strokeWidth={1} className="size-24" />
        <p className="text-headline text-label">{fileKindLabel(asset)}</p>
        <p className="text-footnote">{formatFileSize(asset.size)}</p>
      </div>
    );
  }

  const previewUrl =
    asset.mimeType === "image/svg+xml" || asset.mimeType === "image/gif"
      ? asset.url
      : assetImageUrl(asset, { width: PREVIEW_WIDTH, format: "webp" });

  if (!canUpdate) {
    return (
      <div className="flex size-full items-center justify-center">
        <img
          src={previewUrl}
          alt={asset.alt}
          className="max-h-full max-w-full rounded-control object-contain shadow-float"
        />
      </div>
    );
  }

  return (
    <div className="flex size-full flex-col gap-3">
      <div className="min-h-0 flex-1">
        <FocalPointPicker
          imageUrl={previewUrl}
          aspectRatio={aspectRatio}
          value={focalPoint}
          onChange={onFocalPointChange}
          onCommit={onFocalPointCommit}
        />
      </div>
      <p className="text-center text-footnote text-label-secondary" aria-hidden="true">
        {t("media.detail.focalPoint.help")}
      </p>
    </div>
  );
}
