import { composeFrame } from "../keyframes/buildKeyframes.js";
import { cssNameOf } from "../keyframes/composeGroup.js";
import type { PointerTrigger } from "../spec/trigger.schema.js";
import type { Playback } from "../runtime/playback.js";
import { listen, type AttachedTrigger, type TriggerContext } from "./triggerContext.js";

/**
 * Animations that follow the pointer, such as a tilting card or a magnetic button.
 *
 * Here the timeline isn't time: a track with input "x" is at 0 when the pointer is at the
 * element's left edge and at 1 at its right edge (input "y" runs top to bottom). The
 * element's box is measured once when the pointer arrives, and each frame only writes
 * styles. When the pointer leaves, everything eases back to the middle (0.5).
 */

interface PointerPosition {
  x: number;
  y: number;
}

const resting: PointerPosition = { x: 0.5, y: 0.5 };
const closeEnough = 0.0005;

export function attachPointer(
  context: TriggerContext,
  trigger: PointerTrigger,
  manual: boolean,
): AttachedTrigger {
  const { root, elements, spec } = context;
  const window = root.ownerDocument.defaultView;
  const previousStyles = elements.map((element) => element.style.cssText);
  let current = { ...resting };
  let target = { ...resting };
  let box: DOMRect | undefined;
  let frame = 0;

  const write = (position: PointerPosition) => {
    const styles = composeFrame(
      spec.tracks,
      (track) => (track.input === "y" ? position.y : position.x),
      spec.easing,
    );
    for (const element of elements) {
      for (const [key, value] of styles) element.style.setProperty(cssNameOf(key), value);
    }
  };

  const step = () => {
    frame = 0;
    const follow = 1 - trigger.smoothing;
    current = {
      x: current.x + (target.x - current.x) * follow,
      y: current.y + (target.y - current.y) * follow,
    };
    write(current);
    const settled =
      Math.abs(target.x - current.x) < closeEnough && Math.abs(target.y - current.y) < closeEnough;
    if (!settled) schedule();
  };
  const schedule = () => {
    if (frame === 0 && window) frame = window.requestAnimationFrame(step);
  };

  const playback: Playback = {
    span: spec.duration,
    playForward: () => undefined,
    playBackward: () => ((target = { ...resting }), schedule()),
    restart: () => undefined,
    pause: () => undefined,
    seek: (progress) => ((current = target = { x: progress, y: progress }), write(current)),
    finish: () => ((current = target = { x: 1, y: 1 }), write(current)),
    reset: () => ((current = target = { ...resting }), write(current)),
    finished: () => Promise.resolve(),
    cancel: () =>
      elements.forEach((element, index) => (element.style.cssText = previousStyles[index] ?? "")),
  };

  if (manual) return { playback, detach: () => undefined };
  const detach = listen(root, {
    pointerenter: () => (box = root.getBoundingClientRect()),
    pointermove: (event) => {
      if (!(event instanceof PointerEvent)) return;
      box ??= root.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return;
      target = {
        x: Math.min(Math.max((event.clientX - box.left) / box.width, 0), 1),
        y: Math.min(Math.max((event.clientY - box.top) / box.height, 0), 1),
      };
      schedule();
    },
    pointerleave: () => {
      box = undefined;
      playback.playBackward();
    },
  });
  return {
    playback,
    detach: () => {
      detach();
      if (frame !== 0) window?.cancelAnimationFrame(frame);
    },
  };
}
