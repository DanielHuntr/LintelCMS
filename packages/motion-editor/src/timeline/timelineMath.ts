/** Measurements for the timeline: where time is on screen, and how often to label it. */

const tickSteps = [10, 20, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10_000];

/** The gap between labelled ticks, in ms, so labels sit at least `minimumGap` pixels apart. */
export function tickStep(pixelsPerMillisecond: number, minimumGap = 56): number {
  return (
    tickSteps.find((step) => step * pixelsPerMillisecond >= minimumGap) ?? tickSteps.at(-1) ?? 1000
  );
}

export function ticks(duration: number, step: number): number[] {
  const count = Math.floor(duration / step);
  return Array.from({ length: count + 1 }, (_, index) => index * step);
}

/** "0.35 s": seconds read more naturally than milliseconds for anyone not counting frames. */
export function formatSeconds(milliseconds: number): string {
  const seconds = milliseconds / 1000;
  return `${seconds.toFixed(seconds < 10 ? 2 : 1).replace(/\.?0+$/, "") || "0"} s`;
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

/** The width of the whole animation on screen at zoom 1. */
export const baseTimelineWidth = 560;
