import type { EffectModuleName } from "../effects/effect-types.js";

/**
 * What each effect module costs a page that uses it, gzipped, with the shared code it
 * imports. Measured by scripts/measure-effect-modules.mjs; a test checks it stays current.
 */
export const effectModuleBytes: Record<EffectModuleName, number> = {
  cursor: 7582,
  depth: 5079,
  "frosted-glass": 4093,
  "image-distort": 4566,
  intro: 2591,
  "liquid-gradient": 4839,
  lottie: 3156,
  marquee: 3135,
  particles: 2788,
  physics: 7282,
  playground: 4687,
  pointer: 5177,
  ripple: 4289,
  rive: 2479,
  scroll: 4759,
  "smooth-scroll": 1961,
  svg: 4985,
  text: 5477,
  transitions: 1786,
};
