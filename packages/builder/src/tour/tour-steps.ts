import type { BuilderStringKey } from "../i18n/builder-strings.js";
import type { SkillLevel } from "../skill-level/skill-levels.js";

/**
 * The first-time tour: six stops, in the order people meet them. Each step points at the
 * part of the screen it's about (CSS selectors; with more than one, the spotlight covers them
 * all). A step whose target isn't on screen (no Publish button without permission) sits in
 * the middle instead. Some steps say a little more, or less, for each skill level.
 */
export interface TourStep {
  id: string;
  targets: readonly string[];
  title: BuilderStringKey;
  text: BuilderStringKey;
}

interface TourStepDefinition {
  id: string;
  targets: readonly string[];
  title: BuilderStringKey;
  text: BuilderStringKey | Record<SkillLevel, BuilderStringKey>;
}

const tourStepDefinitions: readonly TourStepDefinition[] = [
  {
    id: "insert",
    targets: ["#lintel-left-tab-insert"],
    title: "pageBuilder.tour.insert.title",
    text: "pageBuilder.tour.insert.text",
  },
  {
    id: "layers",
    targets: ["#lintel-left-tab-layers"],
    title: "pageBuilder.tour.layers.title",
    text: "pageBuilder.tour.layers.text",
  },
  {
    id: "canvas",
    targets: ['[data-tour="canvas"]'],
    title: "pageBuilder.tour.canvas.title",
    text: "pageBuilder.tour.canvas.text",
  },
  {
    id: "panel",
    targets: ['[data-tour="selected-element"]'],
    title: "pageBuilder.tour.panel.title",
    text: {
      beginner: "pageBuilder.tour.panel.beginnerText",
      designer: "pageBuilder.tour.panel.designerText",
      developer: "pageBuilder.tour.panel.developerText",
    },
  },
  {
    id: "screens",
    targets: ['[data-tour="screen-size"]', '[data-tour="history"]'],
    title: "pageBuilder.tour.screens.title",
    text: {
      beginner: "pageBuilder.tour.screens.beginnerText",
      designer: "pageBuilder.tour.screens.text",
      developer: "pageBuilder.tour.screens.text",
    },
  },
  {
    id: "publish",
    targets: ['[data-tour="publish"]'],
    title: "pageBuilder.tour.publish.title",
    text: "pageBuilder.tour.publish.text",
  },
];

/** The tour as someone at this skill level sees it. */
export function tourStepsFor(level: SkillLevel): TourStep[] {
  return tourStepDefinitions.map((step) => ({
    id: step.id,
    targets: step.targets,
    title: step.title,
    text: typeof step.text === "string" ? step.text : step.text[level],
  }));
}

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
