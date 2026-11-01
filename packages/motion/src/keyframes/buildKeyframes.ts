import { easingToCss, type EasingCssOptions } from "../easing/easing.js";
import type { Easing } from "../spec/easing.schema.js";
import type { Track } from "../spec/motion.schema.js";
import { catalogueProperties, isCssVariable } from "../spec/properties.js";
import { composeGroupValue, keyframeKeyOf } from "./composeGroup.js";
import { sampleTrack, withEndKeyframes } from "./sampleTrack.js";

/**
 * Turns a spec's tracks into Web Animations keyframes: one set per CSS property.
 *
 * A track that has its CSS property to itself keeps its keyframes and easings exactly.
 * When tracks share one (translateX and translateY both write `translate`) and their
 * keyframes don't line up, Lintel samples them together at small steps instead, because a
 * keyframe's easing in CSS applies to every property in it.
 */

export interface PropertyKeyframes {
  /** The camelCase CSS property these keyframes write, e.g. "translate" or "--glow". */
  keyframeKey: string;
  keyframes: Keyframe[];
  /** The tracks behind it, so the runtime can register CSS variables. */
  tracks: Track[];
}

/** Samples per animation when tracks are blended; with keyframe offsets added on top. */
const blendedSamples = 30;

export function groupTracks(tracks: readonly Track[]): Map<string, Track[]> {
  const order = (track: Track) =>
    isCssVariable(track.property) ? Infinity : catalogueProperties.indexOf(track.property);
  const groups = new Map<string, Track[]>();
  for (const track of [...tracks].sort((first, second) => order(first) - order(second))) {
    const key = keyframeKeyOf(track.property);
    groups.set(key, [...(groups.get(key) ?? []), track]);
  }
  return groups;
}

function keyframesLineUp(tracks: readonly Track[]): boolean {
  const [first, ...others] = tracks.map((track) => withEndKeyframes(track.keyframes));
  if (!first) return true;
  return others.every(
    (keyframes) =>
      keyframes.length === first.length &&
      keyframes.every(
        (keyframe, index) =>
          keyframe.offset === first[index]?.offset &&
          JSON.stringify(keyframe.easing) === JSON.stringify(first[index]?.easing),
      ),
  );
}

function exactKeyframes(
  keyframeKey: string,
  tracks: readonly Track[],
  defaultEasing: Easing,
  easingOptions: EasingCssOptions,
): Keyframe[] {
  const padded = tracks.map((track) => withEndKeyframes(track.keyframes));
  return (padded[0] ?? []).map((keyframe, index) => {
    const values = new Map(
      tracks.map((track, trackIndex) => [track.property, padded[trackIndex]?.[index]?.value ?? ""]),
    );
    return {
      offset: keyframe.offset,
      easing: easingToCss(keyframe.easing ?? defaultEasing, easingOptions),
      [keyframeKey]: composeGroupValue(keyframeKey, values),
    };
  });
}

function blendedKeyframes(keyframeKey: string, tracks: readonly Track[], defaultEasing: Easing) {
  const offsets = new Set<number>();
  for (let step = 0; step <= blendedSamples; step += 1) offsets.add(step / blendedSamples);
  for (const track of tracks) for (const keyframe of track.keyframes) offsets.add(keyframe.offset);
  return [...offsets]
    .sort((first, second) => first - second)
    .map((offset): Keyframe => {
      const values = new Map(
        tracks.map((track) => [track.property, sampleTrack(track, offset, defaultEasing)]),
      );
      return { offset, easing: "linear", [keyframeKey]: composeGroupValue(keyframeKey, values) };
    });
}

export function buildKeyframes(
  tracks: readonly Track[],
  defaultEasing: Easing,
  easingOptions: EasingCssOptions,
): PropertyKeyframes[] {
  return [...groupTracks(tracks)].map(([keyframeKey, sharedTracks]) => ({
    keyframeKey,
    tracks: sharedTracks,
    keyframes:
      sharedTracks.length === 1 || keyframesLineUp(sharedTracks)
        ? exactKeyframes(keyframeKey, sharedTracks, defaultEasing, easingOptions)
        : blendedKeyframes(keyframeKey, sharedTracks, defaultEasing),
  }));
}

/** Every track's value at one moment, composed into CSS values: used for pointer animations. */
export function composeFrame(
  tracks: readonly Track[],
  offsetOf: (track: Track) => number,
  defaultEasing: Easing,
): Map<string, string> {
  const frame = new Map<string, string>();
  for (const [keyframeKey, sharedTracks] of groupTracks(tracks)) {
    const values = new Map(
      sharedTracks.map((track) => [
        track.property,
        sampleTrack(track, offsetOf(track), defaultEasing),
      ]),
    );
    frame.set(keyframeKey, composeGroupValue(keyframeKey, values));
  }
  return frame;
}
