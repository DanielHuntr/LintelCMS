import { describeProperty, isCssVariable, type MotionSpec, type Track } from "@lintel/motion";

/**
 * The Simple panel's friendly sliders, as changes to a base spec. They are always applied
 * to the spec as it was when the preset was chosen, so moving a slider back and forth never
 * drifts: "speed 2" always means twice as fast as the preset.
 */

export interface SimpleAdjustments {
  /** 1 is as designed; 2 is twice as fast. */
  speed: number;
  /** 1 is as designed; 0 barely moves; 2 moves twice as far. */
  distance: number;
  /** Milliseconds before it starts. */
  delay: number;
  /** Milliseconds between one item and the next, for groups. */
  stagger: number;
}

export function adjustmentsOf(spec: MotionSpec): SimpleAdjustments {
  return { speed: 1, distance: 1, delay: spec.delay, stagger: spec.stagger.each };
}

/** Properties whose size of movement the distance slider scales, and their resting value. */
const restingValue: Partial<Record<string, number>> = {
  translateX: 0,
  translateY: 0,
  translateZ: 0,
  rotate: 0,
  rotateX: 0,
  rotateY: 0,
  skewX: 0,
  skewY: 0,
  blur: 0,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
};

export function isDistanceTrack(track: Track): boolean {
  return !isCssVariable(track.property) && restingValue[track.property] !== undefined;
}

function scaleValue(track: Track, value: number | string, distance: number): number | string {
  const rest = restingValue[track.property];
  if (rest === undefined) return value;
  const unit = describeProperty(track.property).unit;
  const match = typeof value === "number" ? null : /^(-?[\d.]+)([a-z%]*)$/i.exec(value);
  const amount = typeof value === "number" ? value : Number(match?.[1]);
  if (!Number.isFinite(amount)) return value;
  const scaled = Math.round((rest + (amount - rest) * distance) * 1000) / 1000;
  return typeof value === "number" ? scaled : `${scaled}${match?.[2] ?? unit}`;
}

export function hasDistance(spec: MotionSpec): boolean {
  return spec.tracks.some(isDistanceTrack);
}

export function hasManyTargets(spec: MotionSpec): boolean {
  return spec.targets.type !== "self";
}

export function applyAdjustments(base: MotionSpec, adjustments: SimpleAdjustments): MotionSpec {
  const speed = Math.max(adjustments.speed, 0.1);
  return {
    ...base,
    duration: Math.round(base.duration / speed),
    delay: Math.round(adjustments.delay),
    stagger: { ...base.stagger, each: Math.round(adjustments.stagger / speed) },
    tracks: base.tracks.map((track) =>
      isDistanceTrack(track) && adjustments.distance !== 1
        ? {
            ...track,
            keyframes: track.keyframes.map((keyframe) => ({
              ...keyframe,
              value: scaleValue(track, keyframe.value, adjustments.distance),
            })),
          }
        : track,
    ),
  };
}
