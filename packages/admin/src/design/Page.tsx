import type { ReactNode } from "react";
import { classNames } from "./classNames.js";

/**
 * How much of the window a screen uses:
 *
 * - `wide` for overviews, lists, grids and the dashboard: fluid up to 1440px, so big screens
 *   show more at once instead of a narrow column in the middle of empty space.
 * - `readable` for forms and settings: one column of about 720px, where lines and labels
 *   stay easy to follow.
 *
 * Both sit against the sidebar, so every screen's title starts in the same place.
 */
export type PageWidth = "wide" | "readable";

const maxWidths: Record<PageWidth, string> = {
  wide: "max-w-[90rem]",
  readable: "max-w-[45rem]",
};

interface PageProps {
  width: PageWidth;
  className?: string;
  children: ReactNode;
}

export function Page({ width, className, children }: PageProps) {
  return (
    <div data-page-width={width} className={classNames("w-full", maxWidths[width], className)}>
      {children}
    </div>
  );
}

const gridColumns = {
  card: "grid-cols-[repeat(auto-fill,minmax(min(100%,17.5rem),1fr))]",
  panel: "grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))]",
  tile: "grid-cols-[repeat(auto-fill,minmax(min(100%,9.25rem),1fr))]",
} as const;

/**
 * A grid whose items fill the row: as many columns as fit, never narrower than `card`
 * (280px, three across on a laptop and five on a big monitor), `panel` (352px, for cards
 * holding lists) or `tile` (148px, for thumbnails). One column on a narrow window.
 */
export function autoFillGrid(minimum: keyof typeof gridColumns = "card"): string {
  return classNames("grid", gridColumns[minimum]);
}
