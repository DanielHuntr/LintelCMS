import type { EffectModuleName } from "../effects/effect-types.js";

/**
 * What each effect module costs a page that uses it, gzipped, with the shared code it
 * imports. Measured by scripts/measure-effect-modules.mjs; a test checks it stays current.
 */
export const effectModuleBytes: Record<EffectModuleName, number> = {
  cursor: 7412,
  depth: 4970,
  "frosted-glass": 3984,
  "image-distort": 4454,
  intro: 2482,
  "liquid-gradient": 4727,
  marquee: 3030,
  particles: 2683,
  physics: 7176,
  pointer: 5005,
  ripple: 4180,
  scroll: 4650,
  "smooth-scroll": 1854,
  svg: 4879,
  text: 5371,
  transitions: 1682,
};
