import type { InViewTrigger } from "../spec/trigger.schema.js";
import { supportsIntersectionObserver } from "../runtime/environment.js";
import {
  applyLeaveBehaviour,
  type AttachedTrigger,
  type TriggerContext,
} from "./triggerContext.js";

/**
 * Plays when the element scrolls into view. The browser reports visibility through an
 * IntersectionObserver, so nothing is measured on scroll.
 *
 * A threshold of 0.5 can never be met by an element taller than two screens, so an element
 * also counts as in view once it fills that share of the screen.
 */

function isShowing(entry: IntersectionObserverEntry, threshold: number): boolean {
  if (!entry.isIntersecting) return false;
  if (entry.intersectionRatio >= threshold) return true;
  const screenHeight = entry.rootBounds?.height ?? 0;
  return screenHeight > 0 && entry.intersectionRect.height >= screenHeight * threshold;
}

export function attachInView(context: TriggerContext, trigger: InViewTrigger): AttachedTrigger {
  const playback = context.createPlayback();
  if (!supportsIntersectionObserver()) {
    playback.playForward();
    return { playback, detach: () => undefined };
  }
  let played = false;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (isShowing(entry, trigger.threshold)) {
          played = true;
          playback.playForward();
          if (trigger.onLeave === "stay") observer.disconnect();
        } else if (played && !entry.isIntersecting) {
          // Only once it is fully off screen, so it doesn't flicker at the edge.
          applyLeaveBehaviour(trigger.onLeave, playback);
        }
      }
    },
    { threshold: [0, trigger.threshold, 1], rootMargin: trigger.rootMargin },
  );
  observer.observe(context.root);
  return { playback, detach: () => observer.disconnect() };
}
