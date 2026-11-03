import { z } from "zod";
import type { NodeEffect, PageNode } from "../document/page-document.schema.js";
import { type AnyComponentDefinition, defineComponent } from "./component-definition.js";
import { imageAddressSchema, oneOf, plainText } from "./component-props.js";

/**
 * The creative pack (decision 0055): text that follows a circle or a curve, Lottie and Rive
 * animations from the media library, and a ready-made pile of stickers visitors can drag
 * and throw. Text on a path is SVG and CSS only; the animations run in effect modules that
 * only pages with one load, and are given their settings as an implied effect (see
 * `impliedAnimationEffect`) rather than one people add on the Animate tab.
 */

/**
 * An animation file's address: empty (Lintel's sample), on this site, or on the web (the
 * media library's files are on the API's address, which is plain http while developing).
 */
const animationAddressSchema = z
  .string()
  .trim()
  .max(2000)
  .refine((address) => address === "" || /^(https?:\/\/|\/(?!\/))/i.test(address), {
    error: "An animation file's address should start with https://, http:// or /",
  })
  .default("");

export const pathTextShapes = ["circle", "arc", "wave"] as const;
export type PathTextShape = (typeof pathTextShapes)[number];

export const pathTextComponent = defineComponent({
  type: "pathText",
  label: "Text on a path",
  keywords: ["circle", "badge", "sticker", "curved text", "arc", "wave", "rotating", "round"],
  description: "Words around a circle, like a sticker, or along an arc or a wave.",
  icon: "circle-dashed",
  category: "text",
  propsSchema: z.object({
    text: plainText(200, "Trust your gut · Made by hand · "),
    shape: oneOf(pathTextShapes, "The shape"),
    turn: oneOf(["slowly", "off", "scroll"], "How it turns"),
  }),
  defaultProps: { text: "Trust your gut · Made by hand · ", shape: "circle", turn: "slowly" },
  defaultStyles: {
    base: {
      fontSize: "15px",
      fontWeight: "600",
      textTransform: "uppercase",
    },
  },
  allowedChildren: "none",
  editableFields: [
    { kind: "text", prop: "text", label: "Words" },
    {
      kind: "choice",
      prop: "shape",
      label: "Shape",
      choices: [
        { value: "circle", label: "Circle badge" },
        { value: "arc", label: "Arc" },
        { value: "wave", label: "Wave" },
      ],
    },
    {
      kind: "choice",
      prop: "turn",
      label: "Turning (circle badges)",
      choices: [
        { value: "slowly", label: "Turns slowly" },
        { value: "scroll", label: "Turns as visitors scroll" },
        { value: "off", label: "Stays still" },
      ],
    },
  ],
});

const posterField = {
  kind: "image",
  prop: "poster",
  label: "Still picture (before it plays, and for less motion)",
  advanced: true,
} as const;

export const lottieAnimationComponent = defineComponent({
  type: "lottieAnimation",
  label: "Lottie animation",
  keywords: ["lottie", "animation", "json", "dotlottie", "after effects", "bodymovin", "motion"],
  description:
    "Plays a Lottie animation (.json or .lottie) from your media library: on its own, on hover or as visitors scroll.",
  icon: "film",
  category: "media",
  propsSchema: z.object({
    src: animationAddressSchema,
    play: oneOf(["view", "load", "hover", "scroll"], "When it plays"),
    loop: z.boolean().default(true),
    label: plainText(200, ""),
    poster: imageAddressSchema.default(""),
  }),
  defaultProps: { src: "", play: "view", loop: true, label: "", poster: "" },
  defaultStyles: { base: { width: "240px", maxWidth: "100%", aspectRatio: "1 / 1" } },
  allowedChildren: "none",
  editableFields: [
    { kind: "file", prop: "src", label: "Animation file", accept: [".json", ".lottie"] },
    {
      kind: "choice",
      prop: "play",
      label: "Plays",
      choices: [
        { value: "view", label: "When it comes into view" },
        { value: "load", label: "As soon as the page opens" },
        { value: "hover", label: "When the pointer is over it" },
        { value: "scroll", label: "As visitors scroll" },
      ],
    },
    { kind: "toggle", prop: "loop", label: "Play again at the end" },
    { kind: "text", prop: "label", label: "What it shows (for screen readers)" },
    posterField,
  ],
});

export const riveAnimationComponent = defineComponent({
  type: "riveAnimation",
  label: "Rive animation",
  keywords: ["rive", "riv", "animation", "interactive", "state machine", "motion"],
  description:
    "Plays a Rive animation (.riv) from your media library, and can respond to the pointer or a click.",
  icon: "shapes",
  category: "media",
  propsSchema: z.object({
    src: animationAddressSchema,
    play: oneOf(["view", "load"], "When it plays"),
    respondTo: oneOf(["none", "hover", "click"], "What it responds to"),
    label: plainText(200, ""),
    poster: imageAddressSchema.default(""),
    input: plainText(60, ""),
    stateMachine: plainText(60, ""),
  }),
  defaultProps: {
    src: "",
    play: "view",
    respondTo: "hover",
    label: "",
    poster: "",
    input: "",
    stateMachine: "",
  },
  defaultStyles: { base: { width: "240px", maxWidth: "100%", aspectRatio: "1 / 1" } },
  allowedChildren: "none",
  editableFields: [
    { kind: "file", prop: "src", label: "Animation file", accept: [".riv"] },
    {
      kind: "choice",
      prop: "play",
      label: "Plays",
      choices: [
        { value: "view", label: "When it comes into view" },
        { value: "load", label: "As soon as the page opens" },
      ],
    },
    {
      kind: "choice",
      prop: "respondTo",
      label: "Responds to",
      choices: [
        { value: "none", label: "Nothing" },
        { value: "hover", label: "The pointer over it" },
        { value: "click", label: "A click or tap" },
      ],
    },
    { kind: "text", prop: "label", label: "What it shows (for screen readers)" },
    posterField,
    { kind: "text", prop: "input", label: "Input it changes (if not the first)", advanced: true },
    {
      kind: "text",
      prop: "stateMachine",
      label: "State machine (if not the first)",
      advanced: true,
    },
  ],
});

const sticker = (text: string, tone: string) => ({
  type: "badge",
  props: { text, tone, icon: "" },
  styles: { base: { fontSize: "1.125rem", paddingTop: "0.6rem", paddingBottom: "0.6rem" } },
});

export const stickerPlaygroundComponent = defineComponent({
  type: "stickerPlayground",
  label: "Sticker playground",
  keywords: ["physics", "drag", "throw", "stickers", "playful", "gravity", "fun"],
  description: "A box of stickers and badges visitors can pick up, throw and bump into each other.",
  icon: "hand",
  category: "blocks",
  propsSchema: z.object({ label: plainText(100, "Stickers to play with") }),
  defaultProps: { label: "Stickers to play with" },
  defaultChildren: [
    sticker("Fresh today", "brand"),
    sticker("Made by hand", "neutral"),
    {
      type: "pathText",
      props: { text: "Trust your gut · Trust your gut · ", shape: "circle", turn: "off" },
      styles: { base: { fontSize: "11px", fontWeight: "600", textTransform: "uppercase" } },
    },
    sticker("Open late", "success"),
    sticker("Say hello", "warning"),
  ],
  defaultStyles: {
    base: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "flex-start",
      gap: "1rem",
      minHeight: "360px",
      paddingTop: "1.5rem",
      paddingRight: "1.5rem",
      paddingBottom: "1.5rem",
      paddingLeft: "1.5rem",
      borderRadius: "24px",
      backgroundColor: "var(--lintel-color-surface)",
      overflow: "hidden",
    },
  },
  defaultEffects: [{ effect: "drag-playground", params: {} }],
  allowedChildren: "any",
  editableFields: [
    { kind: "text", prop: "label", label: "What the playground is called (for screen readers)" },
  ],
});

export const creativeComponents = [
  pathTextComponent,
  lottieAnimationComponent,
  riveAnimationComponent,
  stickerPlaygroundComponent,
] as unknown as readonly AnyComponentDefinition[];

/**
 * The effect that plays a Lottie or Rive element, made from its own settings, so the page's
 * effects runtime loads its player only where one is used. Undefined for other elements.
 */
export function impliedAnimationEffect(node: PageNode): NodeEffect | undefined {
  if (node.hidden) return undefined;
  const props = node.props;
  const text = (name: string) => (typeof props[name] === "string" ? props[name] : "");
  if (node.type === "lottieAnimation") {
    return {
      effect: "lottie-player",
      params: { src: text("src"), play: text("play") || "view", loop: props.loop !== false },
    };
  }
  if (node.type === "riveAnimation") {
    return {
      effect: "rive-player",
      params: {
        src: text("src"),
        play: text("play") || "view",
        respondTo: text("respondTo") || "none",
        input: text("input"),
        stateMachine: text("stateMachine"),
      },
    };
  }
  return undefined;
}

/** The SVG path each shape's words follow, and the box it is drawn in, in em. */
export interface PathTextGeometry {
  path: string;
  width: number;
  height: number;
  /** For the circle: the path's length, which the words are spread evenly along. */
  length?: number;
}

/** Unknown shapes (from a newer version, say) are drawn as the circle. */
export function pathTextGeometry(shape: string): PathTextGeometry {
  if (shape === "arc") return { path: "M 1 7 Q 12 -3 23 7", width: 24, height: 7.5 };
  if (shape === "wave") {
    return { path: "M 0 3.5 Q 3 0.5 6 3.5 T 12 3.5 T 18 3.5 T 24 3.5", width: 24, height: 6 };
  }
  // A circle in a 10em box, starting at the top and going clockwise, with room outside it
  // for the letters, which stand on it.
  const radius = 3.75;
  return {
    path: `M 5 ${5 - radius} a ${radius} ${radius} 0 1 1 0 ${radius * 2} a ${radius} ${radius} 0 1 1 0 ${-radius * 2}`,
    width: 10,
    height: 10,
    length: Math.round(2 * Math.PI * radius * 100) / 100,
  };
}
