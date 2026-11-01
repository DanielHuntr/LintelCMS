import { z } from "zod";
import { parseNumericValue, unitsUsed } from "../keyframes/values.js";
import { easingSchema } from "./easing.schema.js";
import {
  catalogueProperties,
  describeProperty,
  isCatalogueProperty,
  isNumericKind,
  isUnitAllowed,
  type AnimatableProperty,
} from "./properties.js";
import { triggerSchema } from "./trigger.schema.js";

/**
 * The animation spec: the JSON the builder saves and the runtime plays.
 *
 * This file is the single source of truth for its shape. The runtime only imports the
 * types, so sites never download Zod; the server and the editor validate with these schemas.
 * Times are in milliseconds. Keyframe positions are fractions (0 to 1) of `duration`.
 */

export * from "./easing.schema.js";
export * from "./trigger.schema.js";

const cssVariablePattern = /^--[a-zA-Z][\w-]*$/;

export const propertyNameSchema = z.custom<AnimatableProperty>(
  (value) =>
    typeof value === "string" && (isCatalogueProperty(value) || cssVariablePattern.test(value)),
  { message: `Use one of ${catalogueProperties.join(", ")}, or a CSS variable like --glow.` },
);

export const keyframeSchema = z.object({
  /** Where in the animation this keyframe sits, from 0 (start) to 1 (end). */
  offset: z.number().min(0).max(1),
  /** A number (in the property's usual unit), or text such as "20%", "#fff" or "inset(0 0 0 0)". */
  value: z.union([z.number().finite(), z.string().min(1).max(500)]),
  /** How the change from this keyframe to the next speeds up and slows down. */
  easing: easingSchema.optional(),
});

export const trackSchema = z
  .object({
    property: propertyNameSchema,
    keyframes: z.array(keyframeSchema).min(2).max(50),
    /** Only for the pointer trigger: whether the track follows the pointer across or down. */
    input: z.enum(["x", "y"]).optional(),
    /** Only for CSS variables: their type (e.g. "<length>"), so the browser can blend them. */
    variableSyntax: z.string().max(80).optional(),
  })
  .superRefine((track, context) => {
    const offsets = track.keyframes.map((keyframe) => keyframe.offset);
    if (offsets.some((offset, index) => index > 0 && offset < (offsets[index - 1] ?? 0))) {
      context.addIssue({ code: "custom", message: "Keyframes must be in time order." });
    }
    const definition = describeProperty(track.property);
    if (!isNumericKind(definition.kind)) return;
    const values = track.keyframes.map((keyframe) =>
      parseNumericValue(keyframe.value, definition.unit),
    );
    if (
      values.some((value) => value === undefined || !isUnitAllowed(definition.kind, value.unit))
    ) {
      context.addIssue({
        code: "custom",
        message: `${track.property} needs numbers, like ${definition.unit ? `20 or "20${definition.unit}"` : "0.5"}.`,
      });
    } else if (unitsUsed(values.filter((value) => value !== undefined)).size > 1) {
      context.addIssue({
        code: "custom",
        message: `${track.property} mixes units. Use one unit for every keyframe in a track.`,
      });
    }
  });

/** Which elements move: the element itself, others by node id, a selector, its children or its text. */
export const targetsSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("self") }),
  z.object({ type: z.literal("nodes"), nodeIds: z.array(z.string().min(1)).min(1).max(200) }),
  z.object({ type: z.literal("selector"), selector: z.string().min(1).max(300) }),
  z.object({ type: z.literal("children") }),
  z.object({ type: z.literal("text"), split: z.enum(["words", "letters"]) }),
]);

/** When there are several targets, each starts `each` ms after the one before. */
export const staggerSchema = z.object({
  each: z.number().min(0).max(5000).default(0),
  from: z.enum(["first", "last", "center", "edges", "random"]).default("first"),
});

export const repeatSchema = z.object({
  /** Extra plays after the first. "forever" keeps going. */
  times: z.union([z.int().min(0).max(1000), z.literal("forever")]).default(0),
  /** Every other play runs backwards, so it swings back and forth. */
  yoyo: z.boolean().default(false),
});

/**
 * What to do for people who ask their device for less motion:
 * "none" leaves the element as it is, "fade" keeps only fades and colour changes,
 * "instant" jumps straight to the end.
 */
export const reducedMotionBehaviourSchema = z.enum(["none", "fade", "instant"]);

export const motionSpecSchema = z
  .object({
    version: z.literal(1).default(1),
    trigger: triggerSchema,
    targets: targetsSchema.default({ type: "self" }),
    stagger: staggerSchema.default({ each: 0, from: "first" }),
    duration: z.number().min(0).max(60_000).default(600),
    delay: z.number().min(0).max(60_000).default(0),
    repeat: repeatSchema.default({ times: 0, yoyo: false }),
    /** The easing for every keyframe that doesn't choose its own. */
    easing: easingSchema.default("easeOut"),
    tracks: z.array(trackSchema).min(1).max(24),
    reducedMotion: reducedMotionBehaviourSchema.default("fade"),
  })
  .superRefine((spec, context) => {
    const properties = spec.tracks.map((track) => track.property);
    const repeated = properties.find((property, index) => properties.indexOf(property) !== index);
    if (repeated) {
      context.addIssue({
        code: "custom",
        path: ["tracks"],
        message: `${repeated} has two tracks. Put all its keyframes in one track.`,
      });
    }
    if (spec.trigger.type === "pointer") {
      spec.tracks.forEach((track, index) => {
        if (!track.input || !isNumericKind(describeProperty(track.property).kind)) {
          context.addIssue({
            code: "custom",
            path: ["tracks", index],
            message: "Pointer animations need number tracks that follow x or y.",
          });
        }
      });
    }
    if (spec.trigger.type === "scroll" && spec.repeat.times !== 0) {
      context.addIssue({
        code: "custom",
        path: ["repeat"],
        message: "Scroll animations follow the scroll position, so they can't repeat.",
      });
    }
  });

export type Keyframe = z.output<typeof keyframeSchema>;
export type Track = z.output<typeof trackSchema>;
export type Targets = z.output<typeof targetsSchema>;
export type Stagger = z.output<typeof staggerSchema>;
export type Repeat = z.output<typeof repeatSchema>;
export type ReducedMotionBehaviour = z.output<typeof reducedMotionBehaviourSchema>;
/** A complete spec, with every default filled in. This is what the runtime plays. */
export type MotionSpec = z.output<typeof motionSpecSchema>;
/** A spec as written by hand, where defaults can be left out. */
export type MotionSpecInput = z.input<typeof motionSpecSchema>;

/** Checks a spec written by hand and fills in the defaults. Throws a ZodError if it's wrong. */
export function defineMotion(input: MotionSpecInput): MotionSpec {
  return motionSpecSchema.parse(input);
}
