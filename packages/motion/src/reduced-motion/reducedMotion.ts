import type { MotionSpec, Track } from "../spec/motion.schema.js";
import { isCalmProperty } from "../spec/properties.js";

/**
 * What an animation becomes for someone who has asked their device for less motion.
 *
 * Each spec chooses its own behaviour, because the right answer depends on the animation:
 * a decorative float can simply not happen, a reveal still wants to fade in, and a menu
 * opening on click still has to end up open.
 */

/** Fades are kept short: they explain a change, they aren't the show. */
const longestFade = 400;

const fadeIn: Track = {
  property: "opacity",
  keyframes: [
    { offset: 0, value: 0 },
    { offset: 1, value: 1 },
  ],
};

const fadeOut: Track = {
  property: "opacity",
  keyframes: [
    { offset: 0, value: 1 },
    { offset: 1, value: 0 },
  ],
};

/** Entrances and exits still need to arrive or leave, so a fade stands in for them. */
function standInFade(spec: MotionSpec): Track | undefined {
  switch (spec.trigger.type) {
    case "load":
    case "inView":
      return fadeIn;
    case "pageExit":
      return fadeOut;
    default:
      return undefined;
  }
}

function fadeOnly(spec: MotionSpec): MotionSpec | undefined {
  if (spec.trigger.type === "pointer") return undefined;
  const calmTracks = spec.tracks.filter((track) => isCalmProperty(track.property));
  const fade = standInFade(spec);
  const tracks = calmTracks.length > 0 ? calmTracks : fade ? [fade] : [];
  if (tracks.length === 0) return undefined;
  return {
    ...spec,
    tracks,
    // Words and letters fading in one by one is still a lot of movement; fade the whole text.
    targets: spec.targets.type === "text" ? { type: "self" } : spec.targets,
    stagger: { ...spec.stagger, each: Math.min(spec.stagger.each, 40) },
    duration: Math.min(spec.duration, longestFade),
    easing: "easeOut",
    repeat: { times: 0, yoyo: false },
  };
}

function instant(spec: MotionSpec): MotionSpec | undefined {
  if (spec.trigger.type === "pointer") return undefined;
  return {
    ...spec,
    // A scroll scene can't jump to its end while the reader scrolls, so it shows the end once.
    trigger: spec.trigger.type === "scroll" ? { type: "load" } : spec.trigger,
    targets: spec.targets.type === "text" ? { type: "self" } : spec.targets,
    duration: 0,
    delay: 0,
    stagger: { ...spec.stagger, each: 0 },
    repeat: { times: 0, yoyo: false },
  };
}

/**
 * The spec to play when reduced motion is on, or undefined to leave the element alone.
 */
export function reduceMotion(spec: MotionSpec): MotionSpec | undefined {
  switch (spec.reducedMotion) {
    case "none":
      return undefined;
    case "fade":
      return fadeOnly(spec);
    case "instant":
      return instant(spec);
  }
}
