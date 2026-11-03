import { definePreset, fromTo } from "./preset.js";

/**
 * How sections open. Moving between whole pages is a site-wide choice (Settings → Your
 * website, see page-transition-looks.ts in effects-catalogue), so the four whole-page
 * animations below are kept only for designs that already use them: they still play, and
 * still open in the editor, but the gallery no longer offers them.
 */

export const retiredPagePresets = [
  definePreset({
    id: "page-fade-in",
    name: "Page fades in",
    description: "The page fades in when it opens. Subtle enough for every page.",
    category: "transition",
    preview: { sample: "page" },
    spec: { trigger: { type: "load" }, duration: 400, tracks: [fromTo("opacity", 0, 1)] },
  }),
  definePreset({
    id: "page-rise-in",
    name: "Page rises in",
    description: "The page fades in and drifts up into place when it opens.",
    category: "transition",
    preview: { sample: "page" },
    spec: {
      trigger: { type: "load" },
      duration: 600,
      easing: "easeOutCubic",
      tracks: [fromTo("opacity", 0, 1), fromTo("translateY", 24, 0)],
    },
  }),
  definePreset({
    id: "page-fade-out",
    name: "Page fades out",
    description: 'The page fades away before the next one opens. Pair it with "Page fades in".',
    category: "transition",
    preview: { sample: "page" },
    spec: {
      trigger: { type: "pageExit" },
      duration: 250,
      easing: "easeIn",
      tracks: [fromTo("opacity", 1, 0)],
    },
  }),
  definePreset({
    id: "page-sink-out",
    name: "Page sinks out",
    description:
      'The page fades and sinks slightly as the visitor leaves. Pair it with "Page rises in".',
    category: "transition",
    preview: { sample: "page" },
    spec: {
      trigger: { type: "pageExit" },
      duration: 300,
      easing: "easeInCubic",
      tracks: [fromTo("opacity", 1, 0), fromTo("translateY", 0, 16)],
    },
  }),
];

export const transitionPresets = [
  definePreset({
    id: "section-curtain",
    name: "Curtain open",
    description: "A section opens from the middle outwards, like curtains parting.",
    category: "transition",
    preview: { sample: "page" },
    spec: {
      trigger: { type: "inView", threshold: 0.3 },
      duration: 1000,
      easing: "easeInOutQuint",
      reducedMotion: "instant",
      tracks: [fromTo("clipPath", "inset(0% 50% 0% 50%)", "inset(0% 0% 0% 0%)")],
    },
  }),
  definePreset({
    id: "section-iris",
    name: "Circle reveal",
    description: "A section is revealed through a growing circle from its centre.",
    category: "transition",
    preview: { sample: "page" },
    spec: {
      trigger: { type: "inView", threshold: 0.3 },
      duration: 1100,
      easing: "easeInOutCubic",
      reducedMotion: "instant",
      tracks: [fromTo("clipPath", "circle(0% at 50% 50%)", "circle(75% at 50% 50%)")],
    },
  }),
  definePreset({
    id: "section-split",
    name: "Split open",
    description: "A section opens from a line across its middle, upwards and downwards at once.",
    category: "transition",
    preview: { sample: "page" },
    spec: {
      trigger: { type: "inView", threshold: 0.3 },
      duration: 1000,
      easing: "easeInOutQuint",
      reducedMotion: "instant",
      tracks: [fromTo("clipPath", "inset(50% 0% 50% 0%)", "inset(0% 0% 0% 0%)")],
    },
  }),
];
