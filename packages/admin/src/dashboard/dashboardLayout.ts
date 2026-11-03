import type { WidgetSize } from "../plugins/adminPlugin.js";

/**
 * A dashboard layout is a list of widgets in reading order, each with a size. These pure
 * functions do everything Edit mode does to it, so tests can check them without a screen.
 */
export interface WidgetPlacement {
  /** "core:recent-edits", or "<plugin id>:<widget id>". */
  widget: string;
  size: WidgetSize;
}

/** A widget that can be placed, as far as layouts are concerned. */
export interface PlaceableWidget {
  fullId: string;
  defaultSize: WidgetSize;
  onDefaultDashboard: boolean;
}

/** Lintel's own starting layout: every widget marked for it, at its default size. */
export function defaultLayout(available: readonly PlaceableWidget[]): WidgetPlacement[] {
  return available
    .filter((widget) => widget.onDefaultDashboard)
    .map((widget) => ({ widget: widget.fullId, size: widget.defaultSize }));
}

/**
 * Splits a saved layout into what the person sees now and what is hidden (a plugin that is
 * switched off, a permission they no longer have). Hidden widgets are kept when the
 * layout is saved, so they come back if the plugin does.
 */
export function splitLayout(
  saved: readonly WidgetPlacement[],
  available: readonly PlaceableWidget[],
): { visible: WidgetPlacement[]; hidden: WidgetPlacement[] } {
  const availableIds = new Set(available.map((widget) => widget.fullId));
  return {
    visible: saved.filter((placement) => availableIds.has(placement.widget)),
    hidden: saved.filter((placement) => !availableIds.has(placement.widget)),
  };
}

export function moveWidget(
  layout: readonly WidgetPlacement[],
  widget: string,
  toIndex: number,
): WidgetPlacement[] {
  const fromIndex = layout.findIndex((placement) => placement.widget === widget);
  const moving = layout[fromIndex];
  if (!moving || toIndex < 0 || toIndex >= layout.length) return [...layout];
  const without = layout.filter((_placement, index) => index !== fromIndex);
  return [...without.slice(0, toIndex), moving, ...without.slice(toIndex)];
}

export function resizeWidget(
  layout: readonly WidgetPlacement[],
  widget: string,
  size: WidgetSize,
): WidgetPlacement[] {
  return layout.map((placement) =>
    placement.widget === widget ? { ...placement, size } : placement,
  );
}

export function removeWidget(
  layout: readonly WidgetPlacement[],
  widget: string,
): WidgetPlacement[] {
  return layout.filter((placement) => placement.widget !== widget);
}

/** New widgets go at the end, where they are easy to find and move. */
export function addWidget(
  layout: readonly WidgetPlacement[],
  widget: PlaceableWidget,
): WidgetPlacement[] {
  if (layout.some((placement) => placement.widget === widget.fullId)) return [...layout];
  return [...layout, { widget: widget.fullId, size: widget.defaultSize }];
}

/** How many of the grid's six columns each size takes, once there is room for columns. */
export const sizeColumnCount: Record<WidgetSize, number> = { small: 2, medium: 3, large: 6 };

/**
 * How many columns each widget takes once the grid has six. The last widget in each row
 * stretches over the columns left at its end, so rows don't end in a gap
 * ("Updates" and "Sales" fill the row together).
 */
export function columnSpans(sizes: readonly WidgetSize[]): number[] {
  const spans = sizes.map((size) => sizeColumnCount[size]);
  let used = 0;
  spans.forEach((span, index) => {
    if (used + span > 6) used = 0;
    used += span;
    const next = spans[index + 1];
    const rowEnds = next === undefined || used + next > 6;
    if (rowEnds) {
      spans[index] = span + (6 - used);
      used = 0;
    }
  });
  return spans;
}
