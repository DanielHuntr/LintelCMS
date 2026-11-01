import { z } from "zod";

/**
 * How a change speeds up and slows down between two keyframes.
 *
 * Named curves cover almost every need; a cubic Bézier is the same thing with the handles
 * exposed; a spring settles like a physical object; steps jump in equal stages.
 */

export const namedEasings = [
  "linear",
  "ease",
  "easeIn",
  "easeOut",
  "easeInOut",
  "easeInSine",
  "easeOutSine",
  "easeInOutSine",
  "easeInCubic",
  "easeOutCubic",
  "easeInOutCubic",
  "easeInQuint",
  "easeOutQuint",
  "easeInOutQuint",
  "easeInExpo",
  "easeOutExpo",
  "easeInOutExpo",
  "easeInBack",
  "easeOutBack",
  "easeInOutBack",
] as const;

export const namedEasingSchema = z.enum(namedEasings);

export const cubicBezierEasingSchema = z.object({
  type: z.literal("cubicBezier"),
  // The x of each handle is time, so it has to stay inside the segment.
  x1: z.number().min(0).max(1),
  y1: z.number().min(-2).max(3),
  x2: z.number().min(0).max(1),
  y2: z.number().min(-2).max(3),
});

export const springEasingSchema = z.object({
  type: z.literal("spring"),
  /** How strongly the spring pulls towards the end. Higher is snappier. */
  stiffness: z.number().min(1).max(1000).default(170),
  /** How quickly the bounce dies away. Lower bounces more. */
  damping: z.number().min(1).max(100).default(26),
  /** How heavy the moving thing feels. Heavier is slower and swings further. */
  mass: z.number().min(0.1).max(10).default(1),
});

export const stepsEasingSchema = z.object({
  type: z.literal("steps"),
  count: z.int().min(1).max(100),
  position: z.enum(["start", "end"]).default("end"),
});

export const easingSchema = z.union([
  namedEasingSchema,
  z.discriminatedUnion("type", [cubicBezierEasingSchema, springEasingSchema, stepsEasingSchema]),
]);

export type NamedEasing = z.output<typeof namedEasingSchema>;
export type CubicBezierEasing = z.output<typeof cubicBezierEasingSchema>;
export type SpringEasing = z.output<typeof springEasingSchema>;
export type StepsEasing = z.output<typeof stepsEasingSchema>;
export type Easing = z.output<typeof easingSchema>;
