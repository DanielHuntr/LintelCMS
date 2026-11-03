import { defineEffect } from "../effect-definition.js";
import { choice, colour, common, number } from "../parameters.js";

/**
 * Canvas and WebGL backgrounds and picture effects. Each paints a static fallback in the
 * page's stylesheet (shown before it loads, without WebGL and for less motion), pauses off
 * screen, and does less on phones.
 */

const particles = (
  id: string,
  name: string,
  description: string,
  defaults: {
    colour: string;
    mode: "repel" | "attract" | "web";
    count: number;
    size: number;
    speed: number;
  },
) =>
  defineEffect({
    id,
    name,
    description,
    category: "canvas",
    kind: "behaviour",
    module: "particles",
    behaviour: "particleField",
    suits: ["container"],
    params: {
      colour: colour("Particle colour", defaults.colour),
      count: number("How many", defaults.count, 10, 200, { step: 5 }),
      mode: choice("Around the pointer they", defaults.mode, [
        ["repel", "Move away"],
        ["attract", "Gather"],
        ["web", "Join up"],
      ]),
    },
    fixed: { size: defaults.size, speed: defaults.speed },
    reducedMotion: "A still scattering of particles.",
    preview: "card",
    weight: "medium",
    keywords: ["particles", "stars", "dots", "background"],
  });

const liquid = (
  id: string,
  name: string,
  description: string,
  colours: [string, string, string, string],
) =>
  defineEffect({
    id,
    name,
    description,
    category: "canvas",
    kind: "behaviour",
    module: "liquid-gradient",
    behaviour: "liquidGradient",
    suits: ["container"],
    params: {
      one: colour("First colour", colours[0]),
      two: colour("Second colour", colours[1]),
      three: colour("Third colour", colours[2]),
      four: colour("Fourth colour", colours[3]),
      speed: common.speed(1),
    },
    staticCss: (selector, props) =>
      `${selector} { background: radial-gradient(at 20% 20%, ${props.one}, transparent 60%), radial-gradient(at 80% 30%, ${props.two}, transparent 60%), radial-gradient(at 30% 90%, ${props.three}, transparent 60%), ${props.four}; }`,
    reducedMotion: "A still frame of the same colours.",
    preview: "card",
    weight: "heavy",
    keywords: ["mesh gradient", "aurora", "background", "webgl"],
  });

export const canvasEffects = [
  particles(
    "particle-repel",
    "Shy particles",
    "Drifting dots behind the content that scatter away from the pointer.",
    { colour: "#7539fd", mode: "repel", count: 70, size: 2.2, speed: 0.3 },
  ),
  particles(
    "particle-gather",
    "Curious particles",
    "Drifting dots that gather around the pointer.",
    { colour: "#0ea5e9", mode: "attract", count: 60, size: 2.6, speed: 0.3 },
  ),
  particles(
    "particle-web",
    "Particle web",
    "Dots joined by fine lines when they drift close: a network look.",
    { colour: "#94a3b8", mode: "web", count: 50, size: 1.8, speed: 0.4 },
  ),
  particles(
    "star-dust",
    "Star dust",
    "Many tiny, slow specks of light. Lovely on a dark section.",
    { colour: "#ffffff", mode: "repel", count: 140, size: 1.1, speed: 0.12 },
  ),
  liquid(
    "liquid-gradient",
    "Liquid gradient",
    "Four colours slowly flowing into one another, stirred by the pointer.",
    ["#7539fd", "#ff5c8a", "#ffb347", "#3ec6ff"],
  ),
  liquid("liquid-sunset", "Sunset flow", "Warm oranges, pinks and violets in slow motion.", [
    "#ff7a59",
    "#ff3d7f",
    "#ffc857",
    "#5b21b6",
  ]),
  liquid("liquid-ocean", "Ocean flow", "Deep blues and teals, like light through water.", [
    "#0ea5e9",
    "#14b8a6",
    "#1e3a8a",
    "#0f172a",
  ]),
  liquid("liquid-mono", "Soft greys", "Quiet greys that drift, for a calm backdrop behind text.", [
    "#f1f5f9",
    "#cbd5e1",
    "#e2e8f0",
    "#94a3b8",
  ]),
  defineEffect({
    id: "image-ripple-hover",
    name: "Liquid picture",
    description: "The picture ripples like liquid while the pointer is over it.",
    category: "canvas",
    kind: "behaviour",
    module: "image-distort",
    behaviour: "imageDistort",
    suits: ["image"],
    params: { strength: number("How strong", 1, 0.2, 3, { step: 0.1 }) },
    fixed: { focus: "whole", trigger: "hover" },
    reducedMotion: "The picture stays still.",
    preview: "image",
    weight: "heavy",
    keywords: ["distortion", "noise", "webgl", "hover"],
  }),
  defineEffect({
    id: "image-lens-hover",
    name: "Lens warp",
    description:
      "Only the part of the picture under the pointer warps, like looking through a lens.",
    category: "canvas",
    kind: "behaviour",
    module: "image-distort",
    behaviour: "imageDistort",
    suits: ["image"],
    params: { strength: number("How strong", 1.6, 0.2, 3, { step: 0.1 }) },
    fixed: { focus: "pointer", trigger: "hover" },
    reducedMotion: "The picture stays still.",
    preview: "image",
    weight: "heavy",
  }),
  defineEffect({
    id: "frosted-glass",
    name: "Frosted glass",
    description:
      "Covers a picture with frost that the pointer or a finger wipes clear; it slowly mists over again.",
    category: "canvas",
    kind: "behaviour",
    module: "frosted-glass",
    behaviour: "frostedGlass",
    suits: ["image", "container"],
    params: {
      brush: number("Wipe size", 60, 20, 200, { unit: "px" }),
      regrow: number("How fast it mists over", 0.6, 0, 2, { step: 0.1 }),
    },
    reducedMotion: "Wiping still works; it doesn't mist over again.",
    preview: "image",
    weight: "medium",
    keywords: ["frost", "blur", "wipe", "reveal"],
  }),
  defineEffect({
    id: "water-ripple",
    name: "Water ripples",
    description: "Ripples spread from the pointer like a finger trailed through water.",
    category: "canvas",
    kind: "behaviour",
    module: "ripple",
    behaviour: "waterRipple",
    suits: ["image", "container"],
    params: { strength: number("How strong", 1, 0.2, 3, { step: 0.1 }) },
    fixed: { trigger: "move" },
    reducedMotion: "No ripples.",
    preview: "image",
    weight: "heavy",
    keywords: ["water", "ripple", "webgl"],
  }),
  defineEffect({
    id: "water-ripple-tap",
    name: "Tap ripples",
    description: "A ripple spreads from wherever people click or tap.",
    category: "canvas",
    kind: "behaviour",
    module: "ripple",
    behaviour: "waterRipple",
    suits: ["image", "container", "button"],
    params: { strength: number("How strong", 1.2, 0.2, 3, { step: 0.1 }) },
    fixed: { trigger: "tap" },
    reducedMotion: "No ripples.",
    preview: "button",
    weight: "heavy",
  }),
];
