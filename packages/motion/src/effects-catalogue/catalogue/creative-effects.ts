import { defineEffect } from "../effect-definition.js";
import { choice, colour, common, number, toggle } from "../parameters.js";

/**
 * The creative pack: quiet shader backgrounds for sections and effects for pictures. Few
 * settings each (its colours, speed, how strong). Colours can be the site's own: the
 * builder offers the site's colours first, saved as `var(--name)` so they follow Site
 * styles, and "currentColor" (the colour of the words), which suits fine lines and dust on
 * light and dark sections alike. See docs/decisions/0057-shader-backgrounds.md.
 */

const readable = () => toggle("Keep words readable", true);
const howMuch = (label: string, value: number) => number(label, value, 0, 1, { step: 0.05 });

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
      "Specks of dust at different depths, drifting up through the light. They shift a little with the pointer.",
    category: "canvas",
    kind: "behaviour",
    module: "shader-backgrounds",
    behaviour: "shaderBackground",
    suits: ["container"],
    params: {
      colour: colour("Dust colour", "currentColor"),
      speed: common.speed(1),
      strength: howMuch("How much dust", 0.5),
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
    reducedMotion: "The grain stays still.",
    preview: "card",
    weight: "light",
    keywords: ["noise", "texture", "film", "overlay", "background"],
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
];
