import { defineEffect } from "../effect-definition.js";
import { choice, colour, common, more, number, text, toggle } from "../parameters.js";
import { customShaderEffectId, layeredBackgroundEffectId } from "../shader-plan.js";

/**
 * The creative pack: quiet shader backgrounds for sections and effects for pictures. Few
 * settings each (its colours, speed, how strong). Colours can be the site's own: the
 * builder offers the site's colours first, saved as `var(--name)` so they follow Site
 * styles, and "currentColor" (the colour of the words), which suits fine lines and dust on
 * light and dark sections alike. See docs/decisions/0057-shader-backgrounds.md.
 */

const readable = () => toggle("Keep words readable", true);
const howMuch = (label: string, value: number) => number(label, value, 0, 1, { step: 0.05 });

/** "More settings": each starts where it leaves a look exactly as it was. */
const size = () => more(number("Size", 1, 0.25, 4, { step: 0.05, unit: "×" }));
const direction = () => more(number("Direction", 0, 0, 360, { step: 5, unit: "°" }));
const softness = () => more(howMuch("Softness", 0.5));
/** A colour that is off until chosen. */
const extraColour = (label: string) => more(colour(label, ""));

/** The effects that rework what's under them: drawn from their own soft field when alone. */
const stack = { module: "shader-stack", behaviour: "shaderStack" } as const;
const usesBelow = (label: string) => more(toggle(label, false));

/**
 * The creative pack's effects: a container whose items visitors can drag and throw, and the
 * players behind the Lottie and Rive elements. The players are set by their elements' own
 * fields (`listed: false`), so the gallery leaves them out; see decision 0055.
 */

export const dragPlaygroundEffectId = "drag-playground";
export const lottiePlayerEffectId = "lottie-player";
export const rivePlayerEffectId = "rive-player";

/** The longest address an animation file may have. */
const addressLength = 2000;

export const creativeEffects = [
  defineEffect({
    id: "moving-gradient",
    name: "Moving gradient",
    description: "Two soft pools of colour drifting slowly over the section's background.",
    category: "canvas",
    kind: "behaviour",
    module: "shader-backgrounds",
    behaviour: "shaderBackground",
    suits: ["container"],
    params: {
      one: colour("First colour", "#e8d5c0"),
      two: colour("Second colour", "#c5d3dc"),
      speed: common.speed(1),
      strength: howMuch("How much colour", 0.55),
      readable: readable(),
      three: extraColour("Third colour"),
      scale: size(),
      direction: direction(),
      softness: softness(),
    },
    fixed: { look: "mesh" },
    staticCss: (selector, props) =>
      `${selector} { background-image: radial-gradient(60% 75% at 20% 25%, ${props.one}, transparent 70%), radial-gradient(55% 70% at 82% 68%, ${props.two}, transparent 70%); }`,
    reducedMotion: "A still frame of the same colours.",
    preview: "card",
    weight: "heavy",
    keywords: ["mesh gradient", "background", "shader", "webgl", "soft"],
  }),
  defineEffect({
    id: "soft-light",
    name: "Soft light",
    description: "Sunlight on the bottom of a pool: bright threads that slowly fold and drift.",
    category: "canvas",
    kind: "behaviour",
    module: "shader-backgrounds",
    behaviour: "shaderBackground",
    suits: ["container"],
    params: {
      background: colour("Background colour", "#dfe9e6"),
      light: colour("Light colour", "#ffffff"),
      speed: common.speed(1),
      strength: howMuch("How bright", 0.5),
      readable: readable(),
      scale: size(),
      direction: direction(),
      softness: softness(),
    },
    fixed: { look: "light" },
    staticCss: (selector, props) =>
      `${selector} { background-color: ${props.background}; background-image: radial-gradient(80% 60% at 40% 0%, ${props.light}, transparent 70%); }`,
    reducedMotion: "A still frame of the light.",
    preview: "card",
    weight: "heavy",
    keywords: ["caustics", "water", "light", "background", "shader", "webgl"],
  }),
  defineEffect({
    id: "floating-dust",
    name: "Floating dust",
    description:
      "Specks of dust at different depths, drifting up through the light. Best on a dark section.",
    category: "canvas",
    kind: "behaviour",
    module: "shader-backgrounds",
    behaviour: "shaderBackground",
    suits: ["container"],
    params: {
      colour: colour("Dust colour", "currentColor"),
      speed: common.speed(1),
      strength: howMuch("How much dust", 0.4),
      scale: size(),
      direction: direction(),
      softness: softness(),
    },
    fixed: { look: "dust" },
    reducedMotion: "The dust stays still.",
    preview: "card",
    weight: "heavy",
    keywords: ["particles", "bokeh", "specks", "stars", "background", "shader"],
  }),
  defineEffect({
    id: "contour-lines",
    name: "Contour lines",
    description:
      "Fine lines like a map's contours, slowly shifting as the land beneath them moves.",
    category: "canvas",
    kind: "behaviour",
    module: "shader-backgrounds",
    behaviour: "shaderBackground",
    suits: ["container"],
    params: {
      colour: colour("Line colour", "currentColor"),
      speed: common.speed(1),
      strength: howMuch("How strong", 0.3),
      detail: more(number("How many lines", 16, 6, 40, { step: 1 })),
      scale: size(),
      direction: direction(),
      softness: softness(),
    },
    fixed: { look: "contours" },
    reducedMotion: "The lines stay still.",
    preview: "card",
    weight: "heavy",
    keywords: ["topographic", "map", "lines", "background", "shader"],
  }),
  defineEffect({
    id: "film-grain",
    name: "Film grain",
    description:
      "A fine grain over the section, like a printed photograph. Works with any colours.",
    category: "canvas",
    kind: "behaviour",
    module: "film-grain",
    behaviour: "filmGrain",
    suits: ["container", "image"],
    params: {
      strength: howMuch("How strong", 0.35),
      size: choice("Grain", "fine", [
        ["fine", "Fine"],
        ["medium", "Medium"],
        ["coarse", "Coarse"],
      ]),
      speed: number("Speed", 1, 0, 3, { step: 0.1, unit: "×" }),
    },
    stackLook: "grain",
    reducedMotion: "The grain stays still.",
    preview: "card",
    weight: "light",
    keywords: ["noise", "texture", "film", "overlay", "background"],
  }),
  defineEffect({
    id: "glass",
    name: "Glass",
    description:
      "Ribbed or rippled glass in front of soft colour. As a layer, it bends the layers under it.",
    category: "canvas",
    kind: "behaviour",
    ...stack,
    stackLook: "glass",
    suits: ["container"],
    params: {
      one: colour("First colour", "#c9d6df"),
      two: colour("Second colour", "#efe7dc"),
      speed: common.speed(1),
      strength: howMuch("How much it bends", 0.4),
      readable: readable(),
      pattern: more(
        choice("Pattern", "0", [
          ["0", "Ribs"],
          ["1", "Ripples"],
          ["2", "Panes"],
        ]),
      ),
      detail: more(number("How many", 14, 3, 48, { step: 1 })),
      direction: direction(),
      softness: more(howMuch("Frosting", 0.3)),
      scale: size(),
    },
    staticCss: (selector, props) =>
      `${selector} { background-image: repeating-linear-gradient(90deg, ${props.one} 0 28px, ${props.two} 28px 56px); }`,
    reducedMotion: "A still frame of the glass.",
    preview: "card",
    weight: "heavy",
    keywords: ["fluted", "ribbed", "reeded", "refraction", "background", "shader", "webgl"],
  }),
  defineEffect({
    id: "halftone",
    name: "Halftone",
    description:
      "Printed dots that grow and shrink. As a layer, it prints the layers under it in dots.",
    category: "canvas",
    kind: "behaviour",
    ...stack,
    stackLook: "halftone",
    suits: ["container"],
    params: {
      ink: colour("Dot colour", "#c4bdaf"),
      paper: colour("Paper colour", "#f6f4ef"),
      speed: common.speed(1),
      strength: howMuch("How much ink", 0.5),
      readable: readable(),
      detail: more(number("Dot spacing", 9, 3, 32, { step: 1, unit: "px" })),
      direction: more(number("Screen angle", 45, 0, 180, { step: 5, unit: "°" })),
      softness: more(howMuch("Softness", 0.1)),
      keep: usesBelow("Dots take the colours beneath"),
      scale: size(),
    },
    staticCss: (selector, props) =>
      `${selector} { background-color: ${props.paper}; background-image: radial-gradient(${props.ink} 22%, transparent 24%); background-size: 9px 9px; }`,
    reducedMotion: "A still frame of the dots.",
    preview: "card",
    weight: "heavy",
    keywords: ["dots", "print", "comic", "newspaper", "background", "shader", "webgl"],
  }),
  defineEffect({
    id: "dithering",
    name: "Dithering",
    description:
      "Soft shapes made only of two colours, like an early computer screen. As a layer, it redraws the layers under it.",
    category: "canvas",
    kind: "behaviour",
    ...stack,
    stackLook: "dither",
    suits: ["container"],
    params: {
      ink: colour("Dark colour", "#c4bdaf"),
      paper: colour("Light colour", "#f6f4ef"),
      speed: common.speed(1),
      strength: howMuch("Contrast", 0.5),
      readable: readable(),
      detail: more(number("Pixel size", 3, 1, 12, { step: 1, unit: "px" })),
      keep: usesBelow("Pixels take the colours beneath"),
      scale: size(),
      direction: direction(),
    },
    staticCss: (selector, props) =>
      `${selector} { background-color: ${props.paper}; background-image: conic-gradient(${props.ink} 25%, transparent 0 50%, ${props.ink} 0 75%, transparent 0); background-size: 6px 6px; }`,
    reducedMotion: "A still frame of the pattern.",
    preview: "card",
    weight: "heavy",
    keywords: ["bayer", "1-bit", "pixels", "retro", "background", "shader", "webgl"],
  }),
  defineEffect({
    id: "aurora",
    name: "Aurora",
    description: "Curtains of light hanging across the section. Best on a dark section.",
    category: "canvas",
    kind: "behaviour",
    ...stack,
    stackLook: "aurora",
    suits: ["container"],
    params: {
      one: colour("Lower colour", "#3fbf9f"),
      two: colour("Upper colour", "#5a6fd8"),
      speed: common.speed(1),
      strength: howMuch("How bright", 0.55),
      readable: readable(),
      three: extraColour("Colour at the brightest"),
      detail: more(number("How many rays", 7, 2, 24, { step: 1 })),
      scale: size(),
      direction: direction(),
      softness: softness(),
    },
    staticCss: (selector, props) =>
      `${selector} { background-image: radial-gradient(70% 45% at 40% 45%, ${props.one}, transparent 70%), radial-gradient(60% 40% at 65% 25%, ${props.two}, transparent 70%); }`,
    reducedMotion: "A still frame of the light.",
    preview: "card",
    weight: "heavy",
    keywords: ["northern lights", "glow", "background", "shader", "webgl"],
  }),
  defineEffect({
    id: "silk",
    name: "Silk",
    description: "Slow folds of cloth, catching the light as they move.",
    category: "canvas",
    kind: "behaviour",
    ...stack,
    stackLook: "silk",
    suits: ["container"],
    params: {
      one: colour("Shadow colour", "#2b2a33"),
      two: colour("Light colour", "#b9a7c9"),
      speed: common.speed(1),
      strength: howMuch("How deep the folds are", 0.5),
      readable: readable(),
      three: extraColour("Shine colour"),
      scale: size(),
      direction: direction(),
      softness: softness(),
    },
    staticCss: (selector, props) =>
      `${selector} { background-color: ${props.one}; background-image: linear-gradient(120deg, ${props.one}, ${props.two} 55%, ${props.one}); }`,
    reducedMotion: "A still frame of the folds.",
    preview: "card",
    weight: "heavy",
    keywords: ["satin", "fabric", "waves", "folds", "background", "shader", "webgl"],
  }),
  defineEffect({
    id: "soft-cells",
    name: "Soft cells",
    description: "A slowly shifting pattern of cells, like pebbles or leaded glass.",
    category: "canvas",
    kind: "behaviour",
    ...stack,
    stackLook: "cells",
    suits: ["container"],
    params: {
      one: colour("First colour", "#e9e4da"),
      two: colour("Second colour", "#d5dcd8"),
      speed: common.speed(1),
      strength: howMuch("How strong the edges are", 0.3),
      readable: readable(),
      three: extraColour("A few cells in"),
      detail: more(number("How many", 5, 2, 20, { step: 1 })),
      scale: size(),
      direction: direction(),
      softness: softness(),
    },
    staticCss: (selector, props) =>
      `${selector} { background-color: ${props.one}; background-image: linear-gradient(135deg, ${props.one}, ${props.two}); }`,
    reducedMotion: "A still frame of the cells.",
    preview: "card",
    weight: "heavy",
    keywords: ["voronoi", "pebbles", "mosaic", "stained glass", "background", "shader", "webgl"],
  }),
  defineEffect({
    id: layeredBackgroundEffectId,
    name: "Layered background",
    description: "Backgrounds stacked like layers in a design tool, each with its own blend.",
    category: "canvas",
    kind: "behaviour",
    ...stack,
    suits: ["container"],
    params: { readable: readable() },
    reducedMotion: "A still frame of the layers.",
    preview: "card",
    weight: "heavy",
    keywords: ["layers", "stack", "blend", "shader", "webgl"],
    // Reached through "Add a layer" on a background, which brings the first layer with it.
    listed: false,
  }),
  // A layer only: its settings come from the code (see customShaderDefinition).
  defineEffect({
    id: customShaderEffectId,
    name: "Custom shader",
    description: "A shader written for this site.",
    category: "canvas",
    kind: "behaviour",
    ...stack,
    suits: ["container"],
    params: {},
    reducedMotion: "A still frame.",
    preview: "card",
    weight: "heavy",
    listed: false,
  }),
  defineEffect({
    id: "develop-reveal",
    name: "Develop from noise",
    description: "The picture develops out of soft, drifting noise as it comes into view.",
    category: "canvas",
    kind: "behaviour",
    module: "picture-effects",
    behaviour: "developReveal",
    suits: ["image"],
    params: { speed: common.speed(1) },
    fixed: { trigger: "appear" },
    reducedMotion: "The picture shows straight away.",
    preview: "image",
    weight: "heavy",
    keywords: ["reveal", "displacement", "noise", "dissolve", "scroll", "webgl"],
  }),
  defineEffect({
    id: "pixel-reveal",
    name: "Pixelate in",
    description: "The picture arrives in big blocks that sharpen in a few quick steps.",
    category: "canvas",
    kind: "behaviour",
    module: "picture-effects",
    behaviour: "pixelReveal",
    suits: ["image"],
    params: {
      blocks: number("Blocks to start with", 32, 8, 96, { step: 4, unit: "px" }),
      speed: common.speed(1),
    },
    fixed: { trigger: "appear" },
    reducedMotion: "The picture shows straight away.",
    preview: "image",
    weight: "light",
    keywords: ["pixels", "mosaic", "reveal", "8-bit"],
  }),
  defineEffect({
    id: "colour-split-hover",
    name: "Colour split",
    description:
      "The picture's colours part very slightly as the pointer moves over it, and settle when it stops.",
    category: "canvas",
    kind: "behaviour",
    module: "picture-effects",
    behaviour: "colourSplit",
    suits: ["image"],
    params: { strength: number("How strong", 0.5, 0.1, 1, { step: 0.05 }) },
    fixed: { trigger: "hover" },
    reducedMotion: "The picture stays still.",
    preview: "image",
    weight: "heavy",
    keywords: ["rgb split", "chromatic", "glitch", "hover", "webgl"],
  }),
  defineEffect({
    id: dragPlaygroundEffectId,
    name: "Drag and throw these",
    description:
      "Visitors can pick up the things inside (stickers, cards, badges), throw them and watch them bump into each other.",
    category: "physics",
    kind: "behaviour",
    module: "playground",
    behaviour: "dragPlayground",
    suits: ["container"],
    params: {
      feel: choice("How things move", "drift", [
        ["drift", "Float and drift"],
        ["fall", "Fall into a pile"],
        ["bouncy", "Bouncy"],
      ]),
      tidyButton: toggle("Show a Tidy up button", true),
      tidyLabel: text("Button words", "Tidy up", 40),
    },
    reducedMotion: "Everything stays where the design put it.",
    weight: "medium",
    preview: "panels",
    keywords: ["physics", "stickers", "gravity", "playful", "throw", "drag"],
  }),
  defineEffect({
    id: lottiePlayerEffectId,
    name: "Lottie animation",
    description: "Plays the Lottie element's animation.",
    category: "svg",
    kind: "behaviour",
    module: "lottie",
    behaviour: "lottiePlayer",
    suits: ["any"],
    params: {
      src: text("Animation file", "", addressLength),
      play: choice("Plays", "view", [
        ["view", "When it comes into view"],
        ["load", "As soon as the page opens"],
        ["hover", "When the pointer is over it"],
        ["scroll", "As visitors scroll"],
      ]),
      loop: toggle("Play again at the end", true),
    },
    reducedMotion: "Shows the still picture, or one still frame.",
    preview: "image",
    listed: false,
  }),
  defineEffect({
    id: rivePlayerEffectId,
    name: "Rive animation",
    description: "Plays the Rive element's animation.",
    category: "canvas",
    kind: "behaviour",
    module: "rive",
    behaviour: "rivePlayer",
    suits: ["any"],
    params: {
      src: text("Animation file", "", addressLength),
      play: choice("Plays", "view", [
        ["view", "When it comes into view"],
        ["load", "As soon as the page opens"],
      ]),
      respondTo: choice("Responds to", "none", [
        ["none", "Nothing"],
        ["hover", "The pointer over it"],
        ["click", "A click or tap"],
      ]),
      input: text("Input name", "", 60),
      stateMachine: text("State machine", "", 60),
    },
    reducedMotion: "Shows the still picture, or the first frame.",
    weight: "heavy",
    preview: "image",
    listed: false,
  }),
];
