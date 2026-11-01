import type { EffectModuleName } from "../effects/effect-types.js";

/**
 * What each effect module costs a page that uses it, gzipped, with the shared code it
 * imports. Measured by scripts/measure-effect-modules.mjs; a test checks it stays current.
 */
export const effectModuleBytes: Record<EffectModuleName, number> = {
  cursor: 3938,
  depth: 4688,
  "frosted-glass": 3844,
  "image-distort": 4173,
  intro: 2327,
  "liquid-gradient": 4401,
  marquee: 2930,
  particles: 2539,
  physics: 7074,
  pointer: 3292,
  ripple: 4056,
  scroll: 4370,
  svg: 4780,
  text: 4970,
  transitions: 1591,
};
