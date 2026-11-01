import { evaluateEasing } from "../easing/easing.js";
import type { Easing } from "../spec/easing.schema.js";
import type { Keyframe as SpecKeyframe, Track } from "../spec/motion.schema.js";
import { describeProperty, isNumericKind } from "../spec/properties.js";
import { formatNumericValue, interpolateNumeric, parseNumericValue } from "./values.js";

/**
 * A track's value at any point in the animation. Before the first keyframe the track holds
 * its first value, and after the last it holds the last, the same as `fill: both`.
 */

/** The keyframes with a keyframe added at 0 and 1 if missing, so every moment has a value. */
export function withEndKeyframes(keyframes: readonly SpecKeyframe[]): SpecKeyframe[] {
  const first = keyframes[0];
  const last = keyframes.at(-1);
  if (!first || !last) return [];
  const padded = [...keyframes];
  if (first.offset > 0) padded.unshift({ offset: 0, value: first.value, easing: "linear" });
  if (last.offset < 1) padded.push({ offset: 1, value: last.value });
  return padded;
}

/** The two keyframes either side of `offset`, and how far between them it is (eased). */
function locate(keyframes: readonly SpecKeyframe[], offset: number, defaultEasing: Easing) {
  const nextIndex = keyframes.findIndex((keyframe) => keyframe.offset > offset);
  if (nextIndex === -1) {
    const last = keyframes.at(-1);
    return last ? { from: last, to: last, progress: 1 } : undefined;
  }
  const to = keyframes[nextIndex];
  const from = keyframes[Math.max(nextIndex - 1, 0)];
  if (!from || !to) return undefined;
  if (nextIndex === 0) return { from: to, to, progress: 1 };
  const span = to.offset - from.offset;
  const linearProgress = span === 0 ? 1 : (offset - from.offset) / span;
  return { from, to, progress: evaluateEasing(from.easing ?? defaultEasing, linearProgress) };
}

/** The track's value at `offset` (0 to 1), as a number in its unit or as text. */
export function sampleTrack(track: Track, offset: number, defaultEasing: Easing): number | string {
  const keyframes = withEndKeyframes(track.keyframes);
  const located = locate(keyframes, offset, defaultEasing);
  if (!located) return "";
  const definition = describeProperty(track.property);
  if (isNumericKind(definition.kind)) {
    const from = parseNumericValue(located.from.value, definition.unit);
    const to = parseNumericValue(located.to.value, definition.unit);
    if (from && to) return formatNumericValue(interpolateNumeric(from, to, located.progress));
  }
  // Text values (clip paths, colours) are left to the browser to blend; here they switch.
  return located.progress < 1 ? located.from.value : located.to.value;
}
