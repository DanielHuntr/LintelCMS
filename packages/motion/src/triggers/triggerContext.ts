import type { MotionSpec } from "../spec/motion.schema.js";
import type { LeaveBehaviour } from "../spec/trigger.schema.js";
import type { ScrollTimelineBinding } from "../runtime/createAnimations.js";
import type { Playback } from "../runtime/playback.js";

/** What every trigger is given: the element it listens to and a way to make the animations. */
export interface TriggerContext {
  root: HTMLElement;
  elements: HTMLElement[];
  spec: MotionSpec;
  createPlayback(scroll?: ScrollTimelineBinding): Playback;
}

/** A trigger wired up: the playback it drives, and how to stop listening. */
export interface AttachedTrigger {
  playback: Playback;
  detach(): void;
}

export function applyLeaveBehaviour(behaviour: LeaveBehaviour, playback: Playback) {
  if (behaviour === "reverse") playback.playBackward();
  else if (behaviour === "reset") playback.reset();
}

/** Adds listeners and returns one function that removes them all. */
export function listen(
  target: EventTarget,
  listeners: Record<string, (event: Event) => void>,
): () => void {
  const entries = Object.entries(listeners);
  for (const [name, listener] of entries)
    target.addEventListener(name, listener, { passive: true });
  return () => {
    for (const [name, listener] of entries) target.removeEventListener(name, listener);
  };
}
