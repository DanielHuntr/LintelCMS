import type { EffectModuleName } from "../effects/effect-types.js";

/**
 * What each effect module costs a page that uses it, gzipped, with the shared code it
 * imports. Measured by scripts/measure-effect-modules.mjs; a test checks it stays current.
 */
export const effectModuleBytes: Record<EffectModuleName, number> = {
  cursor: 3938,
  depth: 4684,
  "frosted-glass": 3739,
  "image-distort": 4080,
  intro: 1955,
  "liquid-gradient": 4208,
  marquee: 2926,
  particles: 2528,
  physics: 6087,
  pointer: 3294,
  ripple: 3950,
  scroll: 4366,
  svg: 4781,
  text: 4971,
  transitions: 1591,
};
