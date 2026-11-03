import { z } from "zod";

/**
 * What starts an animation. Each trigger is described in plain English in
 * `docs: Animation spec reference`, and the editor's trigger picker offers the same list.
 */

/** What happens when the reason for playing goes away (the pointer leaves, the section scrolls off). */
export const leaveBehaviourSchema = z.enum(["stay", "reverse", "reset"]);

export const loadTriggerSchema = z.object({ type: z.literal("load") });

/** What an animation does at one moment of scrolling past it. */
export const scrollActionSchema = z.enum([
  "play",
  "reverse",
  "restart",
  "reset",
  "pause",
  "resume",
  "finish",
  "none",
]);
export type ScrollAction = z.infer<typeof scrollActionSchema>;

/**
 * An action for each moment: scrolling down into view (`enter`), on past it (`leave`), back
 * up into view (`enterBack`) and back up past it (`leaveBack`). Like `onLeave`, but telling
 * the directions apart: "play on the way down, reverse on the way back up".
 */
export const scrollActionsSchema = z.object({
  enter: scrollActionSchema.default("play"),
  leave: scrollActionSchema.default("none"),
  enterBack: scrollActionSchema.default("none"),
  leaveBack: scrollActionSchema.default("none"),
});
export type ScrollActions = z.infer<typeof scrollActionsSchema>;

export const inViewTriggerSchema = z.object({
  type: z.literal("inView"),
  /** How much of the element (or of the screen, for tall elements) must show: 0 to 1. */
  threshold: z.number().min(0).max(1).default(0.25),
  /** Grows or shrinks the screen edges, like CSS margin: "0px 0px -10% 0px". */
  rootMargin: z
    .string()
    .regex(/^(-?\d+(\.\d+)?(px|%)\s*){1,4}$/, "Use one to four lengths in px or %.")
    .default("0px"),
  /** "stay" plays once; "reverse" plays backwards when it scrolls away; "reset" rewinds. */
  onLeave: leaveBehaviourSchema.default("stay"),
  /** An action per direction; when set, it's used instead of `onLeave`. */
  actions: scrollActionsSchema.optional(),
});

/**
 * A point in a scroll scene: "when this part of the element reaches this part of the screen".
 * Both are fractions from the top: element 0 is its top edge, viewport 1 is the bottom of the screen.
 */
export const scrollMarkerSchema = z.object({
  element: z.number().min(0).max(1),
  viewport: z.number().min(0).max(1),
});

export const scrollTriggerSchema = z.object({
  type: z.literal("scroll"),
  /** "element" follows this element through the screen; "page" follows the whole page. */
  scope: z.enum(["element", "page"]).default("element"),
  /** By default the scene runs from the element entering at the bottom to leaving at the top. */
  start: scrollMarkerSchema.default({ element: 0, viewport: 1 }),
  end: scrollMarkerSchema.default({ element: 1, viewport: 0 }),
  /**
   * Holds the element's first child on screen while the page scrolls past, for sticky reveals
   * and sideways-scrolling sections. `length` is how long the hold lasts, in screen heights.
   */
  pin: z.object({ length: z.number().min(0.25).max(10) }).optional(),
  /**
   * How far behind the scrolling the scene follows, in seconds: 0 follows exactly, 0.5 eases
   * after it softly. Smoothed scenes are run by Lintel rather than the browser's timelines.
   */
  smooth: z.number().min(0).max(2).default(0),
  /**
   * Points in the scene (0 to 1) it settles on when scrolling stops, so it rests on a step,
   * not halfway through one. It moves the scene, never the page, so people keep control of
   * their scrolling.
   */
  snap: z.array(z.number().min(0).max(1)).min(1).max(20).optional(),
});

export const hoverTriggerSchema = z.object({
  type: z.literal("hover"),
  onLeave: leaveBehaviourSchema.default("reverse"),
});

export const clickTriggerSchema = z.object({
  type: z.literal("click"),
  /** Off: every click plays it again. On: clicks take turns playing forwards and backwards. */
  toggle: z.boolean().default(false),
});

export const focusTriggerSchema = z.object({
  type: z.literal("focus"),
  onLeave: leaveBehaviourSchema.default("reverse"),
});

/** Follows the pointer across the element: tracks say whether they follow its x or y. */
export const pointerTriggerSchema = z.object({
  type: z.literal("pointer"),
  /** 0 follows the pointer exactly; closer to 1 trails behind it more softly. */
  smoothing: z.number().min(0).max(0.95).default(0.85),
});

export const eventTriggerSchema = z.object({
  type: z.literal("event"),
  /** The name passed to `dispatchEvent(new CustomEvent(name))`, e.g. "cart:added". */
  name: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[\w:.-]+$/, "Use letters, numbers, colons, dots and dashes."),
  listenOn: z.enum(["self", "document"]).default("document"),
});

/** Plays when the page is about to be left; the site waits for it before navigating. */
export const pageExitTriggerSchema = z.object({ type: z.literal("pageExit") });

export const triggerSchema = z.discriminatedUnion("type", [
  loadTriggerSchema,
  inViewTriggerSchema,
  scrollTriggerSchema,
  hoverTriggerSchema,
  clickTriggerSchema,
  focusTriggerSchema,
  pointerTriggerSchema,
  eventTriggerSchema,
  pageExitTriggerSchema,
]);

export type LeaveBehaviour = z.output<typeof leaveBehaviourSchema>;
export type ScrollMarker = z.output<typeof scrollMarkerSchema>;
export type InViewTrigger = z.output<typeof inViewTriggerSchema>;
export type ScrollTrigger = z.output<typeof scrollTriggerSchema>;
export type PointerTrigger = z.output<typeof pointerTriggerSchema>;
export type EventTrigger = z.output<typeof eventTriggerSchema>;
export type Trigger = z.output<typeof triggerSchema>;
export type TriggerType = Trigger["type"];
