import { fromTo } from "../../presets/preset.js";
import { defineEffect } from "../effect-definition.js";
import { choice, number } from "../parameters.js";

const stackLook = (fallback: "pile" | "fan" | "tilted") =>
  choice("Look", fallback, [
    ["pile", "Pile"],
    ["fan", "Fan"],
    ["tilted", "Tilted back"],
  ]);

/** 3D with CSS: scenes, stacks, cylinders and flips. Content stays in reading order. */

/**
 * The flip card's layout lives in the stylesheet, so hover and keyboard focus flip it
 * before any script runs, and without scripts both sides simply show one under another.
 */
const flipCss = (axis: string, onHover: boolean) => (selector: string) => {
  const turned = axis === "x" ? "rotateX(180deg)" : "rotateY(180deg)";
  const flipped = onHover
    ? `${selector}:hover > *, ${selector}:focus-within > *, ${selector}[data-flipped] > *`
    : `${selector}[data-flipped] > *`;
  return `@media (scripting: enabled) {
${selector} { display: grid; perspective: 1200px; }
${selector} > * { grid-area: 1 / 1; backface-visibility: hidden; transition: transform 600ms cubic-bezier(.2,.8,.2,1); }
${selector} > :nth-child(2) { transform: ${turned}; }
${flipped.replace(/ > \*/g, " > :first-child")} { transform: ${turned.replace("180", "-180")}; }
${flipped.replace(/ > \*/g, " > :nth-child(2)")} { transform: none; }
}
@media (scripting: enabled) and (prefers-reduced-motion: reduce) { ${selector} > * { transition: opacity 200ms; } }`;
};

const flip = (
  id: string,
  name: string,
  description: string,
  axis: "x" | "y",
  trigger: "hover" | "click",
) =>
  defineEffect({
    id,
    name,
    description,
    category: "depth",
    kind: "behaviour",
    module: "depth",
    behaviour: "flipCard",
    suits: ["container"],
    params: {},
    fixed: { trigger, axis },
    staticCss: flipCss(axis, trigger === "hover"),
    reducedMotion: "Swaps sides with a quick fade.",
    preview: "card",
    keywords: ["flip", "card", "back"],
  });

export const depthEffects = [
  defineEffect({
    id: "perspective-layers",
    name: "3D layers",
    description:
      "Spreads the layers inside at different depths and turns the scene gently with the pointer.",
    category: "depth",
    kind: "behaviour",
    module: "depth",
    behaviour: "perspectiveScene",
    suits: ["container"],
    params: {
      depth: number("Space between layers", 80, 10, 300, { unit: "px" }),
      angle: number("How far it turns", 8, 0, 25, { unit: "°" }),
    },
    reducedMotion: "Keeps the depth but doesn't turn.",
    preview: "panels",
  }),
  defineEffect({
    id: "card-stack",
    name: "Card stack",
    description:
      "Piles the cards inside on one another. Click, swipe or use the arrow keys to send the top one back.",
    category: "depth",
    kind: "behaviour",
    module: "depth",
    behaviour: "cardStack",
    suits: ["container", "list"],
    params: {
      look: stackLook("pile"),
      spread: number("Offset between cards", 14, 4, 40, { unit: "px" }),
    },
    reducedMotion: "Cards change without sliding.",
    preview: "list",
    keywords: ["deck", "stack", "testimonials", "fan", "3d"],
  }),
  defineEffect({
    id: "card-stack-scroll",
    name: "Cards on scroll",
    description:
      "A 3D stack of the cards inside that shows the next card as the page scrolls past. Swipes and arrow keys work too.",
    category: "depth",
    kind: "behaviour",
    module: "depth",
    behaviour: "cardStack",
    suits: ["container", "list"],
    params: {
      look: stackLook("tilted"),
      spread: number("Offset between cards", 14, 4, 40, { unit: "px" }),
    },
    fixed: { advance: "scroll" },
    reducedMotion: "Cards change without sliding, by tap or arrow keys.",
    preview: "list",
    keywords: ["deck", "stack", "3d", "scroll"],
  }),
  defineEffect({
    id: "card-stack-auto",
    name: "Shuffling cards",
    description: "A card stack that shuffles itself every few seconds, pausing while people look.",
    category: "depth",
    kind: "behaviour",
    module: "depth",
    behaviour: "cardStack",
    suits: ["container", "list"],
    params: {
      autoplay: number("Seconds per card", 4, 2, 15),
      look: stackLook("pile"),
      spread: number("Offset between cards", 14, 4, 40, { unit: "px" }),
    },
    reducedMotion: "Doesn't shuffle by itself.",
    preview: "list",
  }),
  defineEffect({
    id: "cylinder-gallery",
    name: "Cylinder gallery",
    description: "Arranges the pictures inside around a slowly turning cylinder. Drag to spin it.",
    category: "depth",
    kind: "behaviour",
    module: "depth",
    behaviour: "cylinderGallery",
    suits: ["container", "list"],
    params: {
      speed: number("Turning speed", 6, 0, 40, { unit: "°/s" }),
      tilt: number("Tilt", -6, -25, 25, { unit: "°" }),
    },
    reducedMotion: "A row of pictures you can swipe.",
    preview: "panels",
    weight: "medium",
    keywords: ["carousel", "3d", "ring"],
  }),
  defineEffect({
    id: "cylinder-still",
    name: "Spin-to-browse ring",
    description: "Pictures on a 3D ring that only turns when dragged or with the arrow keys.",
    category: "depth",
    kind: "behaviour",
    module: "depth",
    behaviour: "cylinderGallery",
    suits: ["container", "list"],
    params: { tilt: number("Tilt", 0, -25, 25, { unit: "°" }) },
    fixed: { speed: 0 },
    reducedMotion: "A row of pictures you can swipe.",
    preview: "panels",
  }),
  defineEffect({
    id: "arc-carousel",
    name: "Arc carousel",
    description:
      "Lines the pictures inside up on a curve that drifts by. Drag, swipe or scroll to move it.",
    category: "depth",
    kind: "behaviour",
    module: "depth",
    behaviour: "arcCarousel",
    suits: ["container", "list"],
    params: {
      shape: choice("Curve", "away", [
        ["away", "Bends away"],
        ["around", "Wraps round you"],
      ]),
      bend: number("How much it bends", 14, 4, 30, { unit: "°" }),
      speed: number("Drift", 0.25, 0, 1.5, { step: 0.05, unit: "pictures/s" }),
    },
    reducedMotion: "A flat row of pictures you can swipe.",
    preview: "panels",
    weight: "medium",
    keywords: ["carousel", "curved", "gallery", "3d", "arc", "slider"],
  }),
  defineEffect({
    id: "cover-flow",
    name: "Cover flow",
    description: "A swipeable row where the middle item faces you and the others turn away.",
    category: "depth",
    kind: "behaviour",
    module: "depth",
    behaviour: "coverFlow",
    suits: ["container", "list"],
    params: { angle: number("How far the sides turn", 40, 10, 75, { unit: "°" }) },
    reducedMotion: "A flat row you can swipe.",
    preview: "panels",
  }),
  flip(
    "flip-on-hover",
    "Flip on hover",
    "Turns over to show its second layer when the pointer is over it or it has focus.",
    "y",
    "hover",
  ),
  flip(
    "flip-on-click",
    "Flip on click",
    "Turns over when clicked or tapped, and back again. Good for “Learn more” cards.",
    "y",
    "click",
  ),
  flip(
    "flip-vertical",
    "Flip upwards",
    "Turns over top to bottom, like a calendar page.",
    "x",
    "hover",
  ),
  defineEffect({
    id: "depth-on-scroll",
    name: "Depth on scroll",
    description:
      "Puts the things inside a section at different depths, the nearer ones moving further as the page scrolls.",
    category: "depth",
    kind: "behaviour",
    module: "scroll",
    behaviour: "depthOnScroll",
    suits: ["container"],
    params: {
      look: choice("Look", "deep", [
        ["gentle", "Gentle"],
        ["deep", "Deep"],
        ["floating", "Floating"],
      ]),
      strength: number("How strong", 1, 0.3, 2, { step: 0.1, unit: "×" }),
      order: choice("Nearest", "front-first", [
        ["front-first", "First things nearest"],
        ["back-first", "Last things nearest"],
        ["mixed", "Mixed"],
      ]),
    },
    reducedMotion: "Everything sits flat and moves with the page.",
    preview: "panels",
    keywords: ["parallax", "layers", "3d", "depth", "scroll"],
  }),
  defineEffect({
    id: "fold-in",
    name: "Fold down",
    description: "Unfolds from the top edge as it comes into view, like a page turned down.",
    category: "depth",
    kind: "animation",
    suits: ["container", "image"],
    params: { angle: number("Starting fold", 80, 20, 90, { unit: "°" }) },
    animation: ({ angle }) => ({
      trigger: { type: "inView", threshold: 0.25 },
      duration: 900,
      easing: "easeOutCubic",
      tracks: [
        fromTo("perspective", 900, 900),
        fromTo("rotateX", angle, 0),
        fromTo("opacity", 0, 1),
      ],
    }),
    reducedMotion: "Fades in.",
    preview: "card",
  }),
  defineEffect({
    id: "swing-in-3d",
    name: "Door swing",
    description: "Swings open towards you like a door as it comes into view.",
    category: "depth",
    kind: "animation",
    suits: ["container", "image"],
    params: {
      side: choice("Hinge", "left", [
        ["left", "Left"],
        ["right", "Right"],
      ]),
    },
    animation: ({ side }) => ({
      trigger: { type: "inView", threshold: 0.25 },
      duration: 900,
      easing: "easeOutBack",
      tracks: [
        fromTo("perspective", 1000, 1000),
        fromTo("rotateY", side === "left" ? -60 : 60, 0),
        fromTo("opacity", 0, 1),
      ],
    }),
    reducedMotion: "Fades in.",
    preview: "card",
  }),
];
