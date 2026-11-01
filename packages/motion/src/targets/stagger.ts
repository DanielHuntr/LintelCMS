import type { Stagger } from "../spec/motion.schema.js";

/**
 * When each target starts, relative to the first. "center" ripples out from the middle,
 * "edges" ripples in from both ends, and "random" shuffles the same way every time, so a
 * preview and the published page always match.
 */

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function shuffledPositions(count: number): number[] {
  const order = Array.from({ length: count }, (_, index) => index);
  const random = seededRandom(count * 7919);
  for (let index = count - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(random() * (index + 1));
    [order[index], order[swapWith]] = [order[swapWith] ?? 0, order[index] ?? 0];
  }
  const positions: number[] = [];
  order.forEach((target, position) => (positions[target] = position));
  return positions;
}

/** The delay in ms for every target, in document order. */
export function staggerDelays(count: number, stagger: Stagger): number[] {
  if (count === 0) return [];
  const middle = (count - 1) / 2;
  const random = stagger.from === "random" ? shuffledPositions(count) : [];
  return Array.from({ length: count }, (_, index) => {
    switch (stagger.from) {
      case "first":
        return index * stagger.each;
      case "last":
        return (count - 1 - index) * stagger.each;
      case "center":
        return Math.abs(index - middle) * stagger.each;
      case "edges":
        return (middle - Math.abs(index - middle)) * stagger.each;
      case "random":
        return (random[index] ?? 0) * stagger.each;
    }
  });
}
