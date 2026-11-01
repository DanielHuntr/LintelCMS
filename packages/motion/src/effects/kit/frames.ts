/**
 * An animation frame loop that only runs while it has work: it stops when the element is
 * off screen or the tab is hidden, and when `tick` says it has settled. Every continuous
 * effect uses it, which is what keeps idle pages at zero work per frame.
 */

export interface FrameLoop {
  /** Asks for frames again (after the pointer moves, say). */
  wake(): void;
  destroy(): void;
  readonly visible: boolean;
}

/** `tick` gets the milliseconds since the last frame and returns true to keep going. */
export function createFrameLoop(
  element: Element,
  tick: (elapsed: number, now: number) => boolean,
): FrameLoop {
  let frame = 0;
  let last = 0;
  let onScreen = true;
  let wanted = true;
  const step = (now: number) => {
    frame = 0;
    const elapsed = last ? Math.min(now - last, 64) : 16;
    last = now;
    wanted = tick(elapsed, now);
    schedule();
  };
  const schedule = () => {
    if (!frame && wanted && onScreen && document.visibilityState !== "hidden") {
      frame = requestAnimationFrame(step);
    } else if (!wanted || !onScreen) {
      last = 0;
    }
  };
  const observer =
    typeof IntersectionObserver === "function"
      ? new IntersectionObserver((entries) => {
          onScreen = entries.some((entry) => entry.isIntersecting);
          schedule();
        })
      : undefined;
  observer?.observe(element);
  const onVisibility = () => {
    last = 0;
    schedule();
  };
  document.addEventListener("visibilitychange", onVisibility);
  schedule();
  return {
    wake: () => {
      wanted = true;
      schedule();
    },
    destroy: () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    },
    get visible() {
      return onScreen;
    },
  };
}
