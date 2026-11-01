import {
  mountMotion,
  type MotionController,
  type MotionSpec,
  type ReducedMotionPreference,
} from "@lintel/motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion.js";

/**
 * Plays a spec on a preview element. Previews mount in manual mode, so nothing listens for
 * scrolling or hovering inside the studio: "Replay" plays the animation, and scroll and
 * pointer scenes are swept through as if the visitor scrolled or moved the pointer.
 */

export interface MotionPreview {
  rootRef: (element: HTMLElement | null) => void;
  replay(): void;
  /** Shows one moment of the animation, in ms from when the first target starts. */
  seekTime(milliseconds: number): void;
  /** Back to how the element looks at rest: entrances at their end, everything else at its start. */
  reset(): void;
  /** Whether the reduced-motion version is showing. */
  reduced: boolean;
}

const sweepDuration = 1600;

/** Entrances rest at their end, so a preview shows the element rather than an empty space. */
function restsAtEnd(spec: MotionSpec) {
  return spec.trigger.type === "load" || spec.trigger.type === "inView";
}

function showRest(controller: MotionController, spec: MotionSpec) {
  if (restsAtEnd(spec)) controller.finish();
  else controller.reset();
}

function isSwept(spec: MotionSpec) {
  return spec.trigger.type === "scroll" || spec.trigger.type === "pointer";
}

/** Pointer scenes swing right, left and back to the middle; scroll scenes run start to end. */
function sweepProgress(spec: MotionSpec, fraction: number): number {
  if (spec.trigger.type !== "pointer") return fraction;
  return 0.5 + 0.5 * Math.sin(fraction * Math.PI * 2);
}

export function useMotionPreview(
  spec: MotionSpec,
  reducedMotion: ReducedMotionPreference = "auto",
): MotionPreview {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const devicePrefersReduced = usePrefersReducedMotion();
  const reduced = reducedMotion === "reduce" || (reducedMotion === "auto" && devicePrefersReduced);
  const controller = useRef<MotionController | undefined>(undefined);
  const sweepFrame = useRef(0);
  const specKey = JSON.stringify(spec);

  useEffect(() => {
    if (!element) return;
    const mounted = mountMotion(element, JSON.parse(specKey) as MotionSpec, {
      mode: "manual",
      reducedMotion,
    });
    controller.current = mounted;
    showRest(mounted, JSON.parse(specKey) as MotionSpec);
    return () => {
      cancelAnimationFrame(sweepFrame.current);
      mounted.destroy();
      controller.current = undefined;
    };
  }, [element, specKey, reducedMotion]);

  const replay = useCallback(() => {
    const current = controller.current;
    if (!current) return;
    cancelAnimationFrame(sweepFrame.current);
    if (!isSwept(spec)) return current.restart();
    const started = performance.now();
    const step = (now: number) => {
      const fraction = Math.min((now - started) / sweepDuration, 1);
      current.seek(sweepProgress(spec, fraction));
      if (fraction < 1) sweepFrame.current = requestAnimationFrame(step);
    };
    sweepFrame.current = requestAnimationFrame(step);
  }, [spec]);

  const seekTime = useCallback(
    (milliseconds: number) => {
      const current = controller.current;
      if (!current) return;
      if (isSwept(spec)) return current.seek(spec.duration > 0 ? milliseconds / spec.duration : 1);
      current.seek(current.span > 0 ? (spec.delay + milliseconds) / current.span : 1);
    },
    [spec],
  );

  const reset = useCallback(() => {
    cancelAnimationFrame(sweepFrame.current);
    if (controller.current) showRest(controller.current, spec);
  }, [spec]);

  return { rootRef: setElement, replay, seekTime, reset, reduced };
}
