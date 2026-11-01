import { definePreset, fromTo } from "./preset.js";

/** Hover: small responses to the pointer that make things feel touchable. */

export const hoverPresets = [
  definePreset({
    id: "hover-lift",
    name: "Lift",
    description: "Rises slightly when the pointer is over it. The standard for clickable cards.",
    category: "hover",
    preview: { sample: "card" },
    spec: {
      trigger: { type: "hover" },
      duration: 220,
      easing: "easeOut",
      reducedMotion: "none",
      tracks: [fromTo("translateY", 0, -6)],
    },
  }),
  definePreset({
    id: "hover-grow",
    name: "Grow",
    description: "Gets a touch bigger on hover. Good for images in a grid.",
    category: "hover",
    preview: { sample: "image" },
    spec: {
      trigger: { type: "hover" },
      duration: 300,
      easing: "easeOutCubic",
      reducedMotion: "none",
      tracks: [fromTo("scale", 1, 1.05)],
    },
  }),
  definePreset({
    id: "hover-brighten",
    name: "Brighten",
    description: "Lights up a little on hover, without moving. Calm enough for any button.",
    category: "hover",
    preview: { sample: "button" },
    spec: {
      trigger: { type: "hover" },
      duration: 200,
      easing: "easeOut",
      reducedMotion: "instant",
      tracks: [fromTo("brightness", 1, 1.15)],
    },
  }),
  definePreset({
    id: "hover-tilt",
    name: "Tilt",
    description: "Tilts in 3D towards the pointer, like a card held in the hand.",
    category: "hover",
    preview: { sample: "card" },
    spec: {
      trigger: { type: "pointer", smoothing: 0.85 },
      reducedMotion: "none",
      easing: "linear",
      tracks: [
        { ...fromTo("perspective", 800, 800), input: "x" },
        { ...fromTo("rotateY", -10, 10), input: "x" },
        { ...fromTo("rotateX", 10, -10), input: "y" },
      ],
    },
  }),
  definePreset({
    id: "hover-magnetic",
    name: "Magnetic",
    description: "Leans towards the pointer as if pulled by a magnet. Made for buttons.",
    category: "hover",
    preview: { sample: "button" },
    spec: {
      trigger: { type: "pointer", smoothing: 0.8 },
      reducedMotion: "none",
      easing: "linear",
      tracks: [
        { ...fromTo("translateX", -10, 10), input: "x" },
        { ...fromTo("translateY", -8, 8), input: "y" },
      ],
    },
  }),
  definePreset({
    id: "hover-underline",
    name: "Underline sweep",
    description:
      "An underline draws itself in from the left on hover. For text links styled with Lintel's link underline.",
    category: "hover",
    preview: { sample: "link" },
    spec: {
      trigger: { type: "hover" },
      duration: 300,
      easing: "easeInOutCubic",
      reducedMotion: "instant",
      tracks: [{ ...fromTo("--underline", "0%", "100%"), variableSyntax: "<percentage>" }],
    },
  }),
  definePreset({
    id: "press",
    name: "Press",
    description: "Squashes down and springs back when clicked, like a real button.",
    category: "hover",
    preview: { sample: "button" },
    spec: {
      trigger: { type: "click" },
      duration: 450,
      easing: { type: "spring", stiffness: 400, damping: 18, mass: 1 },
      reducedMotion: "none",
      tracks: [
        {
          property: "scale",
          keyframes: [
            { offset: 0, value: 1, easing: "easeOut" },
            { offset: 0.25, value: 0.92 },
            { offset: 1, value: 1 },
          ],
        },
      ],
    },
  }),
];
