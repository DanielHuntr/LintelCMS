import { buildKeyframes } from "../keyframes/buildKeyframes.js";
import type { MotionSpec, Track } from "../spec/motion.schema.js";
import { isCssVariable } from "../spec/properties.js";
import { staggerDelays } from "../targets/stagger.js";
import { supportsLinearEasing } from "./environment.js";
import { createAnimationPlayback, type Playback } from "./playback.js";

/**
 * Creates the paused Web Animations for a spec on its targets. Nothing plays until a
 * trigger says so, but `fill: both` shows the first keyframe straight away, so an element
 * that fades in is already invisible before it is scrolled to.
 */

export interface ScrollTimelineBinding {
  timeline: AnimationTimeline;
  rangeStart?: TimelineRangeOffset;
  rangeEnd?: TimelineRangeOffset;
}

const registeredVariables = new Set<string>();

/** Registers a typed CSS variable once per page, so the browser can blend its values. */
function registerVariable(track: Track) {
  if (!isCssVariable(track.property) || !track.variableSyntax) return;
  if (registeredVariables.has(track.property) || typeof CSS.registerProperty !== "function") return;
  registeredVariables.add(track.property);
  try {
    CSS.registerProperty({
      name: track.property,
      syntax: track.variableSyntax,
      inherits: true,
      initialValue: String(track.keyframes[0]?.value ?? ""),
    });
  } catch {
    // Already registered by the site's own CSS, which wins.
  }
}

export function iterationsOf(spec: MotionSpec): number {
  return spec.repeat.times === "forever" ? Infinity : spec.repeat.times + 1;
}

export function createAnimations(
  elements: readonly HTMLElement[],
  spec: MotionSpec,
  scroll?: ScrollTimelineBinding,
): Playback {
  const plans = buildKeyframes(spec.tracks, spec.easing, {
    supportsLinearFunction: supportsLinearEasing(),
  });
  plans.forEach((plan) => plan.tracks.forEach(registerVariable));
  const delays = staggerDelays(elements.length, spec.stagger);
  const iterations = iterationsOf(spec);
  const animations: Animation[] = [];
  const spans: number[] = [];

  elements.forEach((element, index) => {
    const delay = spec.delay + (delays[index] ?? 0);
    for (const plan of plans) {
      const timing: KeyframeAnimationOptions = scroll
        ? {
            // Scroll scenes take their timing from the scroll position, not the clock.
            duration: "auto",
            fill: "both",
            easing: "linear",
            timeline: scroll.timeline,
            ...(scroll.rangeStart ? { rangeStart: scroll.rangeStart } : {}),
            ...(scroll.rangeEnd ? { rangeEnd: scroll.rangeEnd } : {}),
          }
        : {
            duration: Math.max(spec.duration, 0),
            delay,
            iterations,
            direction: spec.repeat.yoyo ? "alternate" : "normal",
            fill: "both",
            easing: "linear",
          };
      const animation = element.animate(plan.keyframes, timing);
      if (!scroll) animation.pause();
      animations.push(animation);
      spans.push(delay + spec.duration);
    }
  });
  return createAnimationPlayback({ animations, spans });
}
