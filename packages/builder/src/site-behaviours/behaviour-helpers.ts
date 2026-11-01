/** Small helpers the behaviours share. */

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const setUpAlready = new Map<string, WeakSet<Element>>();

/** Every element with `data-behaviour="name"` under `root`, each set up once. */
export function eachBehaviour<Found extends HTMLElement>(
  root: ParentNode,
  name: string,
  setUp: (element: Found) => void,
): void {
  const done = setUpAlready.get(name) ?? new WeakSet<Element>();
  setUpAlready.set(name, done);
  root.querySelectorAll<Found>(`[data-behaviour~="${name}"]`).forEach((element) => {
    if (done.has(element)) return;
    done.add(element);
    setUp(element);
  });
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
