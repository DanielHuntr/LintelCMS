import { defineEffect } from "../effect-definition.js";
import { choice, number, toggle } from "../parameters.js";

/** Endless rows that drift and respond to scrolling. Copies are hidden from screen readers. */

const marquee = (
  id: string,
  name: string,
  description: string,
  defaults: { speed: number; boost: number; direction: "left" | "right" },
) =>
  defineEffect({
    id,
    name,
    description,
    category: "marquee",
    kind: "behaviour",
    module: "marquee",
    behaviour: "velocityMarquee",
    suits: ["container", "list"],
    params: {
      speed: number("Speed", defaults.speed, 5, 300, { unit: "px/s" }),
      boost: number("Speed-up when scrolling", defaults.boost, 0, 15, { step: 0.5, unit: "×" }),
      direction: choice("Direction", defaults.direction, [
        ["left", "To the left"],
        ["right", "To the right"],
      ]),
      pauseOnHover: toggle("Pause under the pointer", true),
    },
    reducedMotion: "A still row people can swipe.",
    preview: "list",
    keywords: ["marquee", "ticker", "logos", "scrolling text"],
  });

export const marqueeEffects = [
  marquee(
    "marquee-drift",
    "Drifting row",
    "The items inside drift sideways in an endless loop and speed up when people scroll.",
    { speed: 60, boost: 4, direction: "left" },
  ),
  marquee(
    "marquee-reverse",
    "Drifting row, reversed",
    "The same endless row, going the other way. Stack two for a crossing effect.",
    { speed: 60, boost: 4, direction: "right" },
  ),
  marquee(
    "marquee-scroll-boost",
    "Scroll-powered row",
    "Barely moves until people scroll, then races along and turns with the scroll direction.",
    { speed: 12, boost: 12, direction: "left" },
  ),
  marquee("marquee-fast", "Ticker", "A quick news-ticker pace for short words and logos.", {
    speed: 160,
    boost: 2,
    direction: "left",
  }),
];
