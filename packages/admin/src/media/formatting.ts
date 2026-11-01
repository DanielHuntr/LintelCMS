import { t } from "../i18n/strings.js";
import { type Asset, isImage } from "./media.api.js";

/** "320 KB", "2.4 MB": the units people see in Finder and Explorer. */
export function formatFileSize(bytes: number): string {
  const [unit, value] =
    bytes >= 1_000_000
      ? (["megabyte", bytes / 1_000_000] as const)
      : bytes >= 1_000
        ? (["kilobyte", bytes / 1_000] as const)
        : (["byte", bytes] as const);
  return new Intl.NumberFormat(undefined, {
    style: "unit",
    unit,
    unitDisplay: "short",
    maximumFractionDigits: unit === "megabyte" ? 1 : 0,
  }).format(value);
}

export function formatUploadDate(isoDate: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(isoDate),
  );
}

export function formatDimensions(asset: Pick<Asset, "width" | "height">): string | undefined {
  if (asset.width === null || asset.height === null) return undefined;
  return t("media.detail.dimensionsValue", { width: asset.width, height: asset.height });
}

/** A short label for the kind of file: "PDF", "XLSX", "JPG". */
export function fileKindLabel(asset: Pick<Asset, "filename">): string {
  const extension = asset.filename.split(".").pop() ?? "";
  return extension.toUpperCase();
}

/** The line under a thumbnail: dimensions for images, the size for documents. */
export function assetSummary(asset: Asset): string {
  return (isImage(asset) && formatDimensions(asset)) || formatFileSize(asset.size);
}
