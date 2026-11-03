import type { InViewTrigger, ScrollAction, ScrollActions } from "../spec/trigger.schema.js";
import { supportsIntersectionObserver } from "../runtime/environment.js";
import type { Playback } from "../runtime/playback.js";
import {
  applyLeaveBehaviour,
  type AttachedTrigger,
  listen,
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

/** Runs one scroll action on an animation. */
export function runScrollAction(action: ScrollAction, playback: Playback): void {
  switch (action) {
    case "play":
    case "resume":
      return playback.playForward();
    case "reverse":
      return playback.playBackward();
    case "restart":
      return playback.restart();
    case "reset":
      return playback.reset();
    case "pause":
      return playback.pause();
    case "finish":
      return playback.finish();
    case "none":
      return;
  }
}

/**
 * Which moment this is, from where the element is: coming into view from below the screen is
 * `enter` (scrolling down), from above it `enterBack`; leaving above the screen is `leave`,
 * below it `leaveBack`.
 */
export function scrollMoment(entering: boolean, elementTop: number): keyof ScrollActions {
  if (entering) return elementTop > 0 ? "enter" : "enterBack";
  return elementTop < 0 ? "leave" : "leaveBack";
}

export function attachInView(context: TriggerContext, trigger: InViewTrigger): AttachedTrigger {
  const playback = context.createPlayback();
  if (!supportsIntersectionObserver()) {
    playback.playForward();
    return { playback, detach: () => undefined };
  }
  if (clipsItself(context)) return attachMeasuredInView(context, trigger, playback);
  if (trigger.actions) return attachWithActions(context, trigger, trigger.actions, playback);
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

/**
 * With an action per direction, the observer keeps watching: each time the element comes into
 * view or leaves it entirely, the matching action runs.
 */
function attachWithActions(
  context: TriggerContext,
  trigger: InViewTrigger,
  actions: ScrollActions,
  playback: Playback,
): AttachedTrigger {
  let showing = false;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const top = entry.boundingClientRect.top;
        if (!showing && isShowing(entry, trigger.threshold)) {
          showing = true;
          runScrollAction(actions[scrollMoment(true, top)], playback);
        } else if (showing && !entry.isIntersecting) {
          showing = false;
          runScrollAction(actions[scrollMoment(false, top)], playback);
        }
      }
    },
    { threshold: [0, trigger.threshold, 1], rootMargin: trigger.rootMargin },
  );
  observer.observe(context.root);
  return { playback, detach: () => observer.disconnect() };
}

/**
 * Chrome counts an element clipped to nothing as out of view, so a reveal that starts by
 * clipping its own element ("Mask reveal up", the section iris) would wait for ever, and its
 * words would stay hidden. Its box isn't clipped, so it's measured instead, on scroll and
 * resize (once per frame), until it has played.
 */
function clipsItself(context: TriggerContext): boolean {
  const { spec } = context;
  return spec.targets.type === "self" && spec.tracks.some((track) => track.property === "clipPath");
}

function attachMeasuredInView(
  context: TriggerContext,
  trigger: InViewTrigger,
  playback: Playback,
): AttachedTrigger {
  let played = false;
  let frame = 0;
  const check = () => {
    frame = 0;
    const box = context.root.getBoundingClientRect();
    const screenHeight = window.innerHeight;
    const visible = Math.max(0, Math.min(box.bottom, screenHeight) - Math.max(box.top, 0));
    const ratio = box.height > 0 ? visible / box.height : 0;
    if (
      visible > 0 &&
      (ratio >= trigger.threshold || visible >= screenHeight * trigger.threshold)
    ) {
      if (!played || trigger.onLeave !== "stay") playback.playForward();
      played = true;
      if (trigger.onLeave === "stay") stop();
    } else if (played && visible === 0) {
      applyLeaveBehaviour(trigger.onLeave, playback);
    }
  };
  const schedule = () => {
    if (frame === 0) frame = requestAnimationFrame(check);
  };
  const stopListening = listen(window, { scroll: schedule, resize: schedule });
  const stop = () => {
    stopListening();
    if (frame !== 0) cancelAnimationFrame(frame);
  };
  schedule();
  return { playback, detach: stop };
}
