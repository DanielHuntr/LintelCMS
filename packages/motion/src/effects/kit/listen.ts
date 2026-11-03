import type { EffectCleanup } from "../effect-types.js";

/** Adds event listeners and returns one function that removes them all. */
export function listen(
  target: EventTarget,
  handlers: Record<string, (event: never) => void>,
  options?: AddEventListenerOptions,
): EffectCleanup {
  const entries = Object.entries(handlers) as Array<[string, EventListener]>;
  for (const [name, handler] of entries) target.addEventListener(name, handler, options);
  return () => {
    for (const [name, handler] of entries) target.removeEventListener(name, handler, options);
  };
}

/** Runs every cleanup, newest first. */
export function combine(...cleanups: Array<EffectCleanup | undefined>): EffectCleanup {
  return () => cleanups.reverse().forEach((cleanup) => cleanup?.());
}
