import type { EffectModuleName } from "../effects/effect-types.js";

/**
 * What each effect module costs a page that uses it, gzipped, with the shared code it
 * imports. Measured by scripts/measure-effect-modules.mjs; a test checks it stays current.
 */
export const effectModuleBytes: Record<EffectModuleName, number> = {
  cursor: 7413,
  depth: 4970,
  "film-grain": 1807,
  "frosted-glass": 2911,
  "image-distort": 6499,
  intro: 2659,
  "liquid-gradient": 5736,
  marquee: 3030,
  particles: 2682,
  physics: 7175,
  "picture-effects": 7511,
  pointer: 5005,
  ripple: 4212,
  scroll: 4651,
  "shader-backgrounds": 7867,
  "smooth-scroll": 1854,
  svg: 4879,
  text: 5371,
  transitions: 1682,
};
