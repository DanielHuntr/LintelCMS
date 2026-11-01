import { describeProperty, type MotionSpec, type Trigger, type TriggerType } from "@lintel/motion";
import { triggerSchema } from "@lintel/motion/schema";

/**
 * Switching what starts an animation. The new trigger gets its defaults from the schema,
 * and the rest of the spec is tidied so it stays valid: pointer animations need every track
 * to follow x or y, and scroll scenes can't repeat.
 */
export function changeTriggerType(spec: MotionSpec, type: TriggerType): MotionSpec {
  if (spec.trigger.type === type) return spec;
  const name = type === "event" ? { name: "motion:play" } : {};
  const trigger = triggerSchema.parse({ type, ...name });
  return withTrigger(spec, trigger);
}

export function withTrigger(spec: MotionSpec, trigger: Trigger): MotionSpec {
  const next: MotionSpec = { ...spec, trigger };
  if (trigger.type === "scroll") next.repeat = { times: 0, yoyo: false };
  if (trigger.type === "pointer") {
    next.tracks = spec.tracks
      .filter(
        (track) =>
          describeProperty(track.property).kind !== "text" &&
          describeProperty(track.property).kind !== "colour",
      )
      .map((track, index) => ({ ...track, input: track.input ?? (index % 2 === 0 ? "x" : "y") }));
    if (next.tracks.length === 0) {
      next.tracks = [
        {
          property: "rotateY",
          input: "x",
          keyframes: [
            { offset: 0, value: -8 },
            { offset: 1, value: 8 },
          ],
        },
        {
          property: "rotateX",
          input: "y",
          keyframes: [
            { offset: 0, value: 8 },
            { offset: 1, value: -8 },
          ],
        },
      ];
    }
  }
  return next;
}
