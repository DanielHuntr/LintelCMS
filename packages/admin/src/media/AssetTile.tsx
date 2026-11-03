import {
  Box,
  Check,
  FileSpreadsheet,
  FileText,
  Film,
  Presentation,
  type LucideIcon,
} from "lucide-react";
import type { KeyboardEvent, Ref } from "react";
import { classNames } from "../design/classNames.js";
import { assetSummary, fileKindLabel } from "./formatting.js";
import type { Asset } from "./media.api.js";

interface AssetTileProps {
  ref?: Ref<HTMLButtonElement>;
  asset: Asset;
  /** Shows a tick, for the image a picker currently holds. */
  isCurrent?: boolean;
  /** Only one tile in the grid is a tab stop; the arrow keys reach the rest. */
  tabIndex: 0 | -1;
  onActivate: () => void;
  onFocus: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

const documentIcons: Partial<Record<string, LucideIcon>> = {
  "text/csv": FileSpreadsheet,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": FileSpreadsheet,
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": Presentation,
  // Lottie and Rive animations.
  "application/json": Film,
  "application/zip+dotlottie": Film,
  "application/x-rive": Film,
  "model/gltf-binary": Box,
};

/** A square thumbnail with the filename underneath, like a photo in a Photos grid. */
export function AssetTile({
  ref,
  asset,
  isCurrent = false,
  tabIndex,
  onActivate,
  onFocus,
  onKeyDown,
}: AssetTileProps) {
  return (
    <button
      ref={ref}
      type="button"
      tabIndex={tabIndex}
      aria-current={isCurrent ? "true" : undefined}
      onClick={onActivate}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      className="group flex w-full flex-col gap-2 rounded-card text-start outline-none"
    >
      <span
        className={classNames(
          "relative block aspect-square w-full overflow-hidden rounded-card bg-fill",
          "transition duration-200 ease-standard group-hover:brightness-[0.94]",
          "group-focus-visible:focus-ring motion-safe:group-active:scale-[0.98]",
          isCurrent && "ring-[3px] ring-accent-fill ring-offset-2 ring-offset-surface",
        )}
      >
        {asset.thumbnailUrl ? (
          <img
            src={asset.thumbnailUrl}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            className="size-full object-cover"
          />
        ) : (
          <DocumentPreview asset={asset} />
        )}
        {isCurrent && (
          <span className="absolute inset-e-2 bottom-2 flex size-6 items-center justify-center rounded-full bg-accent-fill text-on-accent shadow-thumb">
            <Check aria-hidden="true" strokeWidth={2.5} className="size-3.5" />
          </span>
        )}
      </span>
      <span className="min-w-0 px-0.5">
        <span className="block truncate text-footnote font-medium text-label">
          {asset.filename}
        </span>
        <span className="block truncate text-caption text-label-secondary">
          {assetSummary(asset)}
        </span>
      </span>
    </button>
  );
}

function DocumentPreview({ asset }: { asset: Asset }) {
  const Icon = documentIcons[asset.mimeType] ?? FileText;
  return (
    <span className="flex size-full flex-col items-center justify-center gap-2 text-label-secondary">
      <Icon aria-hidden="true" strokeWidth={1.25} className="size-12" />
      <span className="rounded-full bg-surface px-2 py-0.5 text-caption font-semibold tracking-wide">
        {fileKindLabel(asset)}
      </span>
    </span>
  );
}
