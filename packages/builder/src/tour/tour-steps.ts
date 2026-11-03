import type { BuilderStringKey } from "../i18n/builder-strings.js";

/**
 * The first-time tour: nine short stops, in the order people meet them, the same for
 * everyone. Each step points at the part of the screen it's about (CSS selectors; with more
 * than one, the spotlight covers them all). A step whose target isn't on screen (no Publish
 * button without permission) sits in the middle instead. Deeper help waits in the panels as
 * tips, shown the first time each one opens.
 */
export interface TourStep {
  id: string;
  targets: readonly string[];
  title: BuilderStringKey;
  text: BuilderStringKey;
}

export const tourSteps: readonly TourStep[] = [
  {
    id: "insert",
    targets: ["#lintel-left-tab-insert", "#lintel-left-tab-layers"],
    title: "pageBuilder.tour.insert.title",
    text: "pageBuilder.tour.insert.text",
  },
  {
    id: "canvas",
    targets: ['[data-tour="canvas"]'],
    title: "pageBuilder.tour.canvas.title",
    text: "pageBuilder.tour.canvas.text",
  },
  {
    id: "style",
    targets: ['[data-tour="selected-element"]'],
    title: "pageBuilder.tour.style.title",
    text: "pageBuilder.tour.style.text",
  },
  {
    id: "siteStyles",
    targets: ['[data-tour="selected-element"]'],
    title: "pageBuilder.tour.siteStyles.title",
    text: "pageBuilder.tour.siteStyles.text",
  },
  {
    id: "arrange",
    targets: ['[data-tour="selected-element"]'],
    title: "pageBuilder.tour.arrange.title",
    text: "pageBuilder.tour.arrange.text",
  },
  {
    id: "animate",
    targets: ["#lintel-right-tab-animate"],
    title: "pageBuilder.tour.animate.title",
    text: "pageBuilder.tour.animate.text",
  },
  {
    id: "screens",
    targets: ['[data-tour="screen-size"]', '[data-tour="history"]'],
    title: "pageBuilder.tour.screens.title",
    text: "pageBuilder.tour.screens.text",
  },
  {
    id: "views",
    targets: ['[data-tour="page-views"]'],
    title: "pageBuilder.tour.views.title",
    text: "pageBuilder.tour.views.text",
  },
  {
    id: "publish",
    targets: ['[data-tour="publish"]'],
    title: "pageBuilder.tour.publish.title",
    text: "pageBuilder.tour.publish.text",
  },
];

/** The short tour of the client's view (content-only editing): four stops. */
export const clientTourSteps: readonly TourStep[] = [
  {
    id: "page",
    targets: ['[data-tour="canvas"]'],
    title: "pageBuilder.clientTour.page.title",
    text: "pageBuilder.clientTour.page.text",
  },
  {
    id: "panel",
    targets: ['[data-tour="client-panel"]'],
    title: "pageBuilder.clientTour.panel.title",
    text: "pageBuilder.clientTour.panel.text",
  },
  {
    id: "history",
    targets: ['[data-tour="history"]'],
    title: "pageBuilder.clientTour.history.title",
    text: "pageBuilder.clientTour.history.text",
  },
  {
    id: "publish",
    targets: ['[data-tour="publish"]'],
    title: "pageBuilder.clientTour.publish.title",
    text: "pageBuilder.clientTour.publish.text",
  },
];

export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** The smallest box around all of the boxes, or null when there are none. */
export function boxAround(boxes: readonly Box[]): Box | null {
  if (boxes.length === 0) return null;
  const top = Math.min(...boxes.map((box) => box.top));
  const left = Math.min(...boxes.map((box) => box.left));
  const bottom = Math.max(...boxes.map((box) => box.top + box.height));
  const right = Math.max(...boxes.map((box) => box.left + box.width));
  return { top, left, width: right - left, height: bottom - top };
}

/** Where the card goes for a target's box: beside it if there's room, otherwise under it. */
export function placeCard(
  target: Box | null,
  screen: { width: number; height: number },
  card: { width: number; height: number },
): { top: number; left: number } {
  const gap = 12;
  const clampLeft = (left: number) =>
    Math.min(Math.max(left, gap), screen.width - card.width - gap);
  const clampTop = (top: number) => Math.min(Math.max(top, gap), screen.height - card.height - gap);
  if (!target) {
    return {
      top: clampTop((screen.height - card.height) / 2),
      left: clampLeft((screen.width - card.width) / 2),
    };
  }
  const right = target.left + target.width + gap;
  if (right + card.width <= screen.width - gap && target.width < screen.width / 2) {
    return { top: clampTop(target.top), left: right };
  }
  const leftSide = target.left - card.width - gap;
  if (leftSide >= gap && target.width < screen.width / 2) {
    return { top: clampTop(target.top), left: leftSide };
  }
  const below = target.top + target.height + gap;
  if (below + card.height <= screen.height - gap) {
    return { top: below, left: clampLeft(target.left + target.width / 2 - card.width / 2) };
  }
  // A big target, like the canvas: the card sits inside it, near the top.
  return {
    top: clampTop(target.top + 2 * gap),
    left: clampLeft(target.left + target.width / 2 - card.width / 2),
  };
}
