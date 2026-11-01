import { type KeyboardEvent, useRef, useState } from "react";
import { AssetTile } from "./AssetTile.js";
import type { Asset } from "./media.api.js";

interface AssetGridProps {
  assets: readonly Asset[];
  /** Names the grid for screen readers, e.g. "Media files". */
  label: string;
  onActivate: (asset: Asset) => void;
  /** The asset a picker currently holds, marked with a tick. */
  currentAssetId?: string | null;
}

/**
 * A responsive grid of square thumbnails. Tab enters it once; the arrow keys move between
 * tiles (up and down by a whole row), Home and End jump to the ends, Enter opens. That keeps
 * a library of hundreds of files one Tab stop long.
 */
export function AssetGrid({ assets, label, onActivate, currentAssetId }: AssetGridProps) {
  const grid = useRef<HTMLUListElement>(null);
  const tiles = useRef<Array<HTMLButtonElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const tabStop = Math.min(activeIndex, Math.max(assets.length - 1, 0));

  function columnCount(): number {
    const columns = grid.current
      ? getComputedStyle(grid.current).gridTemplateColumns.split(" ").filter(Boolean).length
      : 1;
    return Math.max(columns, 1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const lastIndex = assets.length - 1;
    const columns = columnCount();
    // In a right-to-left language the grid runs from the right, so the arrows swap.
    const forwards = document.documentElement.dir === "rtl" ? -1 : 1;
    const targets: Partial<Record<string, number>> = {
      ArrowLeft: index - forwards,
      ArrowRight: index + forwards,
      ArrowUp: index - columns,
      ArrowDown: index + columns,
      Home: 0,
      End: lastIndex,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const clamped = Math.min(Math.max(target, 0), lastIndex);
    setActiveIndex(clamped);
    tiles.current[clamped]?.focus();
  }

  return (
    <ul
      ref={grid}
      aria-label={label}
      className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-x-4 gap-y-5"
    >
      {assets.map((asset, index) => (
        <li key={asset.id}>
          <AssetTile
            ref={(element) => {
              tiles.current[index] = element;
            }}
            asset={asset}
            isCurrent={asset.id === currentAssetId}
            tabIndex={index === tabStop ? 0 : -1}
            onActivate={() => onActivate(asset)}
            onFocus={() => setActiveIndex(index)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          />
        </li>
      ))}
    </ul>
  );
}

/** Grey squares in the shape of the grid while the first page loads. */
export function AssetGridPlaceholder({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-x-4 gap-y-5"
    >
      {Array.from({ length: 10 }, (_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <div className="aspect-square animate-pulse rounded-card bg-fill" />
          <div className="h-3 w-3/4 rounded-full bg-fill" />
        </div>
      ))}
    </div>
  );
}
