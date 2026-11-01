import {
  sampleTrack,
  type AnimatableProperty,
  type Easing,
  type MotionSpec,
  type Track,
} from "@lintel/motion";

/**
 * Every edit the timeline makes, as pure functions from one spec to the next. Keeping them
 * here (and out of the components) means undo, tests and keyboard and mouse editing all
 * share one set of rules: keyframes stay in time order and a track keeps at least two.
 */

type Value = number | string;

function replaceTrack(
  spec: MotionSpec,
  trackIndex: number,
  update: (track: Track) => Track,
): MotionSpec {
  return {
    ...spec,
    tracks: spec.tracks.map((track, index) => (index === trackIndex ? update(track) : track)),
  };
}

const round = (offset: number) => Math.round(offset * 1000) / 1000;

export function setDuration(spec: MotionSpec, duration: number): MotionSpec {
  return { ...spec, duration: Math.min(Math.max(Math.round(duration), 0), 60_000) };
}

/** Moves a keyframe in time, no further than its neighbours so the order never changes. */
export function moveKeyframe(
  spec: MotionSpec,
  trackIndex: number,
  keyframeIndex: number,
  offset: number,
): MotionSpec {
  return replaceTrack(spec, trackIndex, (track) => {
    const earliest = track.keyframes[keyframeIndex - 1]?.offset ?? 0;
    const latest = track.keyframes[keyframeIndex + 1]?.offset ?? 1;
    const clamped = round(Math.min(Math.max(offset, earliest), latest));
    return {
      ...track,
      keyframes: track.keyframes.map((keyframe, index) =>
        index === keyframeIndex ? { ...keyframe, offset: clamped } : keyframe,
      ),
    };
  });
}

/** Adds a keyframe holding the track's current value at that moment, so nothing jumps. */
export function addKeyframe(
  spec: MotionSpec,
  trackIndex: number,
  offset: number,
): { spec: MotionSpec; keyframeIndex: number } {
  const track = spec.tracks[trackIndex];
  if (!track) return { spec, keyframeIndex: -1 };
  const at = round(Math.min(Math.max(offset, 0), 1));
  const value = sampleTrack(track, at, spec.easing);
  const insertAt = track.keyframes.findIndex((keyframe) => keyframe.offset > at);
  const keyframeIndex = insertAt === -1 ? track.keyframes.length : insertAt;
  const keyframes = [...track.keyframes];
  keyframes.splice(keyframeIndex, 0, { offset: at, value });
  return { spec: replaceTrack(spec, trackIndex, () => ({ ...track, keyframes })), keyframeIndex };
}

export function removeKeyframe(
  spec: MotionSpec,
  trackIndex: number,
  keyframeIndex: number,
): MotionSpec {
  return replaceTrack(spec, trackIndex, (track) =>
    track.keyframes.length <= 2
      ? track
      : { ...track, keyframes: track.keyframes.filter((_, index) => index !== keyframeIndex) },
  );
}

export function setKeyframeValue(
  spec: MotionSpec,
  trackIndex: number,
  keyframeIndex: number,
  value: Value,
): MotionSpec {
  return replaceTrack(spec, trackIndex, (track) => ({
    ...track,
    keyframes: track.keyframes.map((keyframe, index) =>
      index === keyframeIndex ? { ...keyframe, value } : keyframe,
    ),
  }));
}

/** Sets the easing from this keyframe to the next; undefined uses the animation's easing. */
export function setKeyframeEasing(
  spec: MotionSpec,
  trackIndex: number,
  keyframeIndex: number,
  easing: Easing | undefined,
): MotionSpec {
  return replaceTrack(spec, trackIndex, (track) => ({
    ...track,
    keyframes: track.keyframes.map((keyframe, index) => {
      if (index !== keyframeIndex) return keyframe;
      if (easing !== undefined) return { ...keyframe, easing };
      const withoutEasing = { ...keyframe };
      delete withoutEasing.easing;
      return withoutEasing;
    }),
  }));
}

/** Where a new track starts and ends: a small, typical move for each property. */
const startingValues: Partial<Record<AnimatableProperty, [Value, Value]>> = {
  opacity: [0, 1],
  translateX: [-40, 0],
  translateY: [24, 0],
  translateZ: [-100, 0],
  scale: [0.9, 1],
  scaleX: [0, 1],
  scaleY: [0, 1],
  rotate: [-10, 0],
  perspective: [800, 800],
  rotateX: [30, 0],
  rotateY: [30, 0],
  skewX: [8, 0],
  skewY: [8, 0],
  blur: [8, 0],
  brightness: [0.6, 1],
  contrast: [0.6, 1],
  saturate: [0, 1],
  grayscale: [1, 0],
  clipPath: ["inset(0% 100% 0% 0%)", "inset(0% 0% 0% 0%)"],
  color: ["#6e6e73", "#7539fd"],
  backgroundColor: ["#ffffff", "#f1ebff"],
  borderColor: ["#d1d1d6", "#7539fd"],
};

export function addTrack(spec: MotionSpec, property: AnimatableProperty): MotionSpec {
  if (spec.tracks.some((track) => track.property === property)) return spec;
  const [from, to] = startingValues[property] ?? ["0", "1"];
  const track: Track = {
    property,
    keyframes: [
      { offset: 0, value: from },
      { offset: 1, value: to },
    ],
    ...(spec.trigger.type === "pointer" ? { input: "x" as const } : {}),
  };
  return { ...spec, tracks: [...spec.tracks, track] };
}

export function removeTrack(spec: MotionSpec, trackIndex: number): MotionSpec {
  if (spec.tracks.length <= 1) return spec;
  return { ...spec, tracks: spec.tracks.filter((_, index) => index !== trackIndex) };
}

export function setTrack(spec: MotionSpec, trackIndex: number, track: Track): MotionSpec {
  return replaceTrack(spec, trackIndex, () => track);
}
