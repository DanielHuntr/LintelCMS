import type { Easing, MotionSpec } from "@lintel/motion";
import { defaultProps, effectAnimation, type ElementKind } from "@lintel/motion/effects";
import { applyAdjustments, hasDistance, type SimpleAdjustments } from "../simple/adjustSpec.js";
import { changeTriggerType } from "../trigger/changeTrigger.js";
import type { MotionChoice, MotionMoment } from "./motionChoices.js";

/**
 * The short way to add motion: choosing when it moves puts a good default on the element
 * straight away, and a handful of small tiles offer the main alternatives for that moment.
 * Everything here is an existing preset or animation effect; nothing new is saved, only
 * the ordinary animation spec. The full catalogue is still one tap away.
 */

/** The little looping drawing on a tile. Each one is a CSS animation in `motionDemos.ts`. */
export type MotionDemo =
  | "rise"
  | "fade"
  | "words"
  | "slide"
  | "pop"
  | "blur"
  | "reveal"
  | "lift"
  | "grow"
  | "brighten"
  | "tilt"
  | "magnet"
  | "underline"
  | "swing"
  | "press"
  | "throb"
  | "bounce"
  | "shake"
  | "wiggle"
  | "flash"
  | "parallax"
  | "drift"
  | "fadeThrough"
  | "scrollGrow"
  | "turn"
  | "breathe"
  | "spin"
  | "dots"
  | "fill";

export interface QuickPick {
  /** The preset's or animation effect's id. */
  id: string;
  demo: MotionDemo;
  /** Offered only for these kinds of element; for every kind when left out. */
  onlyFor?: readonly ElementKind[];
}

/** At most this many tiles show for a moment: two rows of three. */
export const quickPickLimit = 6;

/**
 * Each moment's tiles, in order; the first is the default that's applied when the moment
 * is chosen. The list is longer than the limit so an element that can't take one still
 * gets six.
 */
export const quickPicks: Record<MotionMoment, readonly QuickPick[]> = {
  appears: [
    { id: "fade-up", demo: "rise" },
    { id: "fade-in", demo: "fade" },
    { id: "words-rise", demo: "words", onlyFor: ["text"] },
    { id: "slide-in-left", demo: "slide" },
    { id: "pop-in", demo: "pop" },
    { id: "blur-in", demo: "blur" },
    { id: "mask-reveal-up", demo: "reveal" },
  ],
  hover: [
    { id: "hover-lift", demo: "lift" },
    { id: "hover-grow", demo: "grow" },
    { id: "hover-brighten", demo: "brighten" },
    { id: "hover-tilt", demo: "tilt" },
    { id: "hover-magnetic", demo: "magnet" },
    { id: "hover-underline", demo: "underline", onlyFor: ["text", "button"] },
    { id: "hover-swing", demo: "swing" },
  ],
  click: [
    { id: "press", demo: "press" },
    { id: "pulse", demo: "throb" },
    { id: "bounce", demo: "bounce" },
    { id: "shake", demo: "shake" },
    { id: "wiggle", demo: "wiggle" },
    { id: "flash", demo: "flash" },
  ],
  scroll: [
    { id: "parallax-slow", demo: "parallax" },
    { id: "scroll-fade-through", demo: "fadeThrough" },
    { id: "parallax-fast", demo: "drift" },
    { id: "scroll-grow", demo: "scrollGrow" },
    { id: "scroll-turn", demo: "turn" },
  ],
  always: [
    { id: "pulse-placeholder", demo: "breathe" },
    { id: "spinner", demo: "spin" },
    { id: "bouncing-dots", demo: "dots" },
    { id: "progress-sweep", demo: "fill" },
  ],
};

export interface QuickChoice {
  pick: QuickPick;
  choice: MotionChoice;
}

/** Whether a choice is saved as an animation (not a behaviour or style effect). */
export function isAnimationChoice(choice: MotionChoice): boolean {
  return choice.kind === "preset" || choice.definition.kind === "animation";
}

/**
 * A moment's tiles for this element: the picks that exist among its choices (which already
 * leave out effects that don't suit it), are animations, and suit the element.
 */
export function quickChoicesFor(
  moment: MotionMoment,
  choices: readonly MotionChoice[],
  elementKind: ElementKind,
): QuickChoice[] {
  const found: QuickChoice[] = [];
  for (const pick of quickPicks[moment]) {
    if (pick.onlyFor && !pick.onlyFor.includes(elementKind)) continue;
    // An id can be both a preset and an effect ("parallax-slow"); the animation is the tile.
    const choice = choices.find(
      (candidate) =>
        candidate.id === pick.id && candidate.moment === moment && isAnimationChoice(candidate),
    );
    if (!choice) continue;
    found.push({ pick, choice });
    if (found.length === quickPickLimit) break;
  }
  return found;
}

/** The animation a choice adds, as designed; undefined for behaviour and style effects. */
export function animationSpecOf(choice: MotionChoice): MotionSpec | undefined {
  if (choice.kind === "preset") return choice.preset.spec;
  if (choice.definition.kind !== "animation") return undefined;
  return effectAnimation(choice.definition, defaultProps(choice.definition.params));
}

/**
 * The spec a tile adds. Eye-catchers normally wait for a custom event; under "Click" they
 * play when the element is clicked, which is what people expect from the tile.
 */
export function quickSpec(choice: MotionChoice, moment: MotionMoment): MotionSpec {
  const spec = animationSpecOf(choice);
  if (!spec) throw new Error(`${choice.id} is not an animation`);
  if (moment === "click" && spec.trigger.type !== "click") return changeTriggerType(spec, "click");
  return spec;
}

/** How it eases into place: as designed and smooth, or with a little spring. */
export type MotionFeel = "smooth" | "springy";

const springyEasing: Easing = { type: "spring", stiffness: 260, damping: 15, mass: 1 };

export function feelOf(spec: MotionSpec): MotionFeel {
  return typeof spec.easing === "object" && spec.easing.type === "spring" ? "springy" : "smooth";
}

export function withFeel(spec: MotionSpec, feel: MotionFeel): MotionSpec {
  if (feelOf(spec) === feel) return spec;
  return { ...spec, easing: feel === "springy" ? springyEasing : "easeOutCubic" };
}

/** The plain controls under the tiles. */
export interface QuickSettings {
  adjustments: SimpleAdjustments;
  feel: MotionFeel;
}

export function settingsOf(spec: MotionSpec): QuickSettings {
  return {
    adjustments: { speed: 1, distance: 1, delay: spec.delay, stagger: spec.stagger.each },
    feel: feelOf(spec),
  };
}

/** The tile's spec with the controls applied: the spec that is saved on the element. */
export function quickResult(base: MotionSpec, settings: QuickSettings): MotionSpec {
  return withFeel(applyAdjustments(base, settings.adjustments), settings.feel);
}

/** Which plain controls make sense for a spec in this moment. */
export function quickControls(base: MotionSpec, moment: MotionMoment) {
  const followsScroll = moment === "scroll";
  const loops = base.repeat.times === "forever";
  return {
    howMuch: hasDistance(base),
    speed: !followsScroll,
    feel: !followsScroll && !loops,
    starts: moment === "appears",
  };
}
