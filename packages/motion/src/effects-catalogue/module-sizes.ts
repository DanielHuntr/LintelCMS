import type { EffectModuleName } from "../effects/effect-types.js";

/**
 * What each effect module costs a page that uses it, gzipped, with the shared code it
 * imports. Measured by scripts/measure-effect-modules.mjs; a test checks it stays current.
 */
export const effectModuleBytes: Record<EffectModuleName, number> = {
  cursor: 4593,
  depth: 4788,
  "frosted-glass": 3984,
  "image-distort": 4272,
  intro: 2430,
  "liquid-gradient": 4545,
  marquee: 3030,
  particles: 2683,
  physics: 7176,
  pointer: 4307,
  ripple: 4180,
  scroll: 4469,
  "smooth-scroll": 1826,
  svg: 4879,
  text: 5070,
  transitions: 1686,
};
