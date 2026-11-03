import type { EffectCleanup } from "../effect-types.js";
import { createFrameLoop } from "./frames.js";
import { combine, listen } from "./listen.js";
import { progressThroughScreen } from "./pointer.js";

/**
 * The effects' scroll engine: calls `draw` with the element's progress through the screen
 * (0 entering at the bottom, 1 leaving at the top) in the frames after the page scrolls or
 * resizes, and only while the element is on screen. `draw` returns true to keep getting
 * frames without scrolling (to ease towards where the scroll left it).
 */
export function onScrollProgress(
  element: HTMLElement,
  draw: (progress: number, elapsed: number, now: number) => boolean | void,
): EffectCleanup {
  const loop = createFrameLoop(
    element,
    (elapsed, now) => draw(progressThroughScreen(element), elapsed, now) === true,
  );
  return combine(
    listen(window, { scroll: () => loop.wake(), resize: () => loop.wake() }, { passive: true }),
    () => loop.destroy(),
  );
}
