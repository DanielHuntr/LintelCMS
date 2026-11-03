import { fromTo } from "../../presets/preset.js";
import { defineEffect } from "../effect-definition.js";
import { text } from "../parameters.js";

/**
 * Effects for single elements as people move between pages. How the whole page changes
 * (fade, rise, sweep, settle) is chosen once for the site, in Settings → Your website.
 */

/** The view transition name a carried element gets: "Hero picture" is lintel-hero-picture. */
export function carriedElementName(name: string): string {
  const safe =
    name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/^-+|-+$/g, "") || "shared";
  return `lintel-${safe}`;
}

export const transitionEffects = [
  defineEffect({
    id: "shared-element",
    name: "Carry across pages",
    description:
      "Give a picture the same name on two pages (a project photo and its large version) and it glides from one to the other. Needs a page transition switched on.",
    category: "transitions",
    kind: "style",
    suits: ["any"],
    params: { name: text("Name to match", "hero-picture", 40) },
    staticCss: (selector, { name }) =>
      `@media (prefers-reduced-motion: no-preference) { ${selector} { view-transition-name: ${carriedElementName(name)}; } }`,
    // Marked with its name, so the page's script finds carried elements without reading
    // every element's styles.
    elementAttributes: ({ name }) => ({ "data-lintel-carried": carriedElementName(name) }),
    reducedMotion: "Pages change without the glide.",
    preview: "image",
    keywords: ["view transition", "shared element", "hero", "morph"],
  }),
  defineEffect({
    id: "exit-fade",
    name: "Fade out when leaving",
    description: "Fades away when people follow a link to another page of the site.",
    category: "transitions",
    kind: "animation",
    suits: ["any"],
    params: {},
    animation: () => ({
      trigger: { type: "pageExit" },
      duration: 300,
      easing: "easeIn",
      tracks: [fromTo("opacity", 1, 0)],
    }),
    reducedMotion: "Leaves at once.",
    preview: "page",
  }),
  defineEffect({
    id: "exit-rise",
    name: "Rise away when leaving",
    description: "Lifts and fades away as people move to another page.",
    category: "transitions",
    kind: "animation",
    suits: ["any"],
    params: {},
    animation: () => ({
      trigger: { type: "pageExit" },
      duration: 400,
      easing: "easeInCubic",
      tracks: [fromTo("opacity", 1, 0), fromTo("translateY", 0, -40)],
    }),
    reducedMotion: "Fades out.",
    preview: "page",
  }),
  defineEffect({
    id: "enter-curtain",
    name: "Curtain on arrival",
    description: "Unveils itself from top to bottom as the page opens.",
    category: "transitions",
    kind: "animation",
    suits: ["container", "image"],
    params: {},
    animation: () => ({
      trigger: { type: "load" },
      duration: 900,
      easing: "easeInOutCubic",
      tracks: [fromTo("clipPath", "inset(0 0 100% 0)", "inset(0 0 0% 0)")],
    }),
    reducedMotion: "Fades in.",
    preview: "page",
  }),
];
