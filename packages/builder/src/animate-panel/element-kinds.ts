import type { ElementKind } from "@lintel/motion/effects";

/**
 * What kind of element each component is, for the Effects gallery's "Suits this element".
 * Anything not listed counts as "any", so every effect is offered for it.
 */
const kinds: Readonly<Record<string, ElementKind>> = {
  heading: "text",
  text: "text",
  quote: "text",
  richText: "text",
  badge: "text",
  counter: "text",
  countdown: "text",
  clock: "text",
  button: "button",
  link: "button",
  menuLink: "button",
  image: "image",
  video: "image",
  beforeAfter: "image",
  icon: "svg",
  list: "list",
  gallery: "list",
  carousel: "list",
  logoStrip: "list",
  marquee: "list",
  featureList: "list",
  timeline: "list",
  section: "container",
  container: "container",
  box: "container",
  columns: "container",
  grid: "container",
  card: "container",
  sticky: "container",
  testimonial: "container",
  pricingTable: "container",
  stickerPlayground: "container",
  pathText: "svg",
  lottieAnimation: "image",
  riveAnimation: "image",
};

export function elementKindOf(type: string): ElementKind {
  return kinds[type] ?? "any";
}
