import type { EffectContext } from "../effect-types.js";
import { listen } from "./listen.js";
import { pointerWithin, progressThroughScreen } from "./pointer.js";
import { approach } from "../maths/smoothing.js";

/**
 * What can drive a number setting: the pointer, scrolling or a repeating timeline. Each is a
 * value from 0 to 1; the setting moves from its own value towards `to` as that value does.
 * With less motion asked for nothing drives anything, and on touch screens the pointer
 * doesn't either, so settings simply stay at their own value.
 */

export type ReactSource = "pointerX" | "pointerY" | "pointerNear" | "scroll" | "timeline";

export interface SettingReact {
  source: ReactSource;
  to: number;
  /** A timeline's length. */
  seconds?: number;
}

export interface Drivers {
  /** Moves things on by this many milliseconds. */
  tick(elapsed: number): void;
  read(react: SettingReact): number;
  /** The pointer, as the shaders read it: 0 to 1 from the bottom left. */
  readonly pointer: readonly [number, number];
  readonly near: number;
  readonly scroll: number;
  destroy(): void;
}

/** A timeline's shape: out and back, easing at both ends. */
export function timelineValue(elapsedSeconds: number, seconds: number): number {
  return 0.5 - 0.5 * Math.cos((elapsedSeconds / Math.max(seconds, 0.1)) * Math.PI * 2);
}

export function createDrivers(element: HTMLElement, context: EffectContext): Drivers {
  const target = { x: 0.5, y: 0.5, near: 0 };
  const eased = { x: 0.5, y: 0.5, near: 0 };
  let seconds = 0;
  const follows = context.finePointer && !context.reduced;
  const stop = follows
    ? listen(element, {
        pointermove: (event: PointerEvent) => {
          const at = pointerWithin(element, event);
          target.x = at.x / 2 + 0.5;
          target.y = 0.5 - at.y / 2;
          target.near = 1;
        },
        pointerleave: () => {
          target.near = 0;
        },
      })
    : () => undefined;
  return {
    tick(elapsed) {
      seconds += elapsed / 1000;
      eased.x = approach(eased.x, target.x, 0.96, elapsed);
      eased.y = approach(eased.y, target.y, 0.96, elapsed);
      eased.near = approach(eased.near, target.near, 0.94, elapsed);
    },
    read({ source, seconds: length }) {
      if (context.reduced) return 0;
      if (source === "scroll") return progressThroughScreen(element);
      if (source === "timeline") return timelineValue(seconds, length ?? 6);
      if (!follows) return 0;
      return source === "pointerX" ? eased.x : source === "pointerY" ? eased.y : eased.near;
    },
    get pointer() {
      return [eased.x, eased.y] as const;
    },
    get near() {
      return eased.near;
    },
    get scroll() {
      return context.reduced ? 0 : progressThroughScreen(element);
    },
    destroy: stop,
  };
}
