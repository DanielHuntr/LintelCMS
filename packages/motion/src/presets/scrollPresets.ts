import { definePreset, fromTo, through } from "./preset.js";

/** Scroll: animations that follow the scroll position, forwards and backwards. */

export const scrollPresets = [
  definePreset({
    id: "parallax-slow",
    name: "Parallax (slow)",
    description: "Moves a little slower than the page, so it seems further away. For backgrounds.",
    category: "scroll",
    preview: { sample: "image" },
    spec: {
      trigger: { type: "scroll" },
      easing: "linear",
      reducedMotion: "none",
      tracks: [fromTo("translateY", -60, 60)],
    },
  }),
  definePreset({
    id: "parallax-fast",
    name: "Parallax (fast)",
    description: "Moves a little faster than the page, so it seems closer. For floating details.",
    category: "scroll",
    preview: { sample: "card" },
    spec: {
      trigger: { type: "scroll" },
      easing: "linear",
      reducedMotion: "none",
      tracks: [fromTo("translateY", 80, -80)],
    },
  }),
  definePreset({
    id: "scroll-fade-through",
    name: "Fade through",
    description: "Fades in as it reaches the middle of the screen and out again as it leaves.",
    category: "scroll",
    preview: { sample: "card" },
    spec: {
      trigger: { type: "scroll" },
      easing: "linear",
      reducedMotion: "none",
      tracks: [through("opacity", [0, 1, 1, 0])],
    },
  }),
  definePreset({
    id: "scroll-grow",
    name: "Grow while scrolling",
    description: "An image grows to full size as it scrolls up the screen.",
    category: "scroll",
    preview: { sample: "image" },
    spec: {
      trigger: {
        type: "scroll",
        start: { element: 0, viewport: 1 },
        end: { element: 0.5, viewport: 0.5 },
      },
      easing: "easeOut",
      reducedMotion: "none",
      tracks: [fromTo("scale", 0.8, 1), fromTo("opacity", 0.4, 1)],
    },
  }),
  definePreset({
    id: "scroll-turn",
    name: "Turn while scrolling",
    description: "Turns slowly as the page scrolls. Good for badges, stamps and icons.",
    category: "scroll",
    preview: { sample: "button" },
    spec: {
      trigger: { type: "scroll" },
      easing: "linear",
      reducedMotion: "none",
      tracks: [fromTo("rotate", -45, 45)],
    },
  }),
  definePreset({
    id: "sticky-reveal",
    name: "Sticky reveal",
    description:
      "The section holds still while its content fades and grows into view, then scrolls on.",
    category: "scroll",
    preview: { sample: "panels" },
    spec: {
      trigger: { type: "scroll", pin: { length: 1 } },
      targets: { type: "selector", selector: ":scope > * > *" },
      easing: "easeOut",
      reducedMotion: "none",
      tracks: [through("opacity", [0, 1, 1]), through("scale", [0.85, 1, 1])],
    },
  }),
  definePreset({
    id: "progress-bar",
    name: "Reading progress bar",
    description: "A bar that fills from left to right as the reader scrolls down the page.",
    category: "scroll",
    preview: { sample: "progress" },
    spec: {
      trigger: { type: "scroll", scope: "page" },
      easing: "linear",
      reducedMotion: "none",
      tracks: [fromTo("clipPath", "inset(0% 100% 0% 0%)", "inset(0% 0% 0% 0%)")],
    },
  }),
  definePreset({
    id: "horizontal-scroll",
    name: "Sideways scrolling section",
    description:
      "Scrolling down moves a row of panels sideways. Set for four full-width panels; change the distance for more or fewer.",
    category: "scroll",
    preview: { sample: "panels" },
    spec: {
      trigger: { type: "scroll", pin: { length: 3 } },
      targets: { type: "selector", selector: ":scope > * > *" },
      easing: "linear",
      reducedMotion: "none",
      tracks: [fromTo("translateX", "0%", "-75%")],
    },
  }),
];
