import type { BuilderStringKey } from "../i18n/builder-strings.js";

/**
 * The first-time tour: the six things people do most, in the order they'll do them. Each
 * step points at the part of the screen it's about (a CSS selector); a step whose target
 * isn't on screen (no Publish button without permission) sits in the middle instead.
 */
export interface TourStep {
  id: string;
  target: string | null;
  title: BuilderStringKey;
  text: BuilderStringKey;
}

export const tourSteps: readonly TourStep[] = [
  {
    id: "welcome",
    target: null,
    title: "pageBuilder.tour.welcome.title",
    text: "pageBuilder.tour.welcome.text",
  },
  {
    id: "select",
    target: '[data-tour="canvas"]',
    title: "pageBuilder.tour.select.title",
    text: "pageBuilder.tour.select.text",
  },
  {
    id: "editText",
    target: '[data-tour="canvas"]',
    title: "pageBuilder.tour.editText.title",
    text: "pageBuilder.tour.editText.text",
  },
  {
    id: "style",
    target: "#lintel-right-tab-style",
    title: "pageBuilder.tour.style.title",
    text: "pageBuilder.tour.style.text",
  },
  {
    id: "insert",
    target: "#lintel-left-tab-insert",
    title: "pageBuilder.tour.insert.title",
    text: "pageBuilder.tour.insert.text",
  },
  {
    id: "animate",
    target: "#lintel-right-tab-animate",
    title: "pageBuilder.tour.animate.title",
    text: "pageBuilder.tour.animate.text",
  },
  {
    id: "skill",
    target: '[data-tour="skill-level"]',
    title: "pageBuilder.tour.skill.title",
    text: "pageBuilder.tour.skill.text",
  },
  {
    id: "publish",
    target: '[data-tour="publish"]',
    title: "pageBuilder.tour.publish.title",
    text: "pageBuilder.tour.publish.text",
  },
];

/** Where the card goes for a target's box: beside it if there's room, otherwise under it. */
export function placeCard(
  target: { top: number; left: number; width: number; height: number } | null,
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
