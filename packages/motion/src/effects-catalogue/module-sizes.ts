import type { EffectModuleName } from "../effects/effect-types.js";

/**
 * What each effect module costs a page that uses it, gzipped, with the shared code it
 * imports. Measured by scripts/measure-effect-modules.mjs; a test checks it stays current.
 */
export const effectModuleBytes: Record<EffectModuleName, number> = {
  cursor: 7484,
  depth: 7125,
  "frosted-glass": 4057,
  "image-distort": 4528,
  intro: 2555,
  "liquid-gradient": 4799,
  marquee: 3105,
  model: 4768,
  particles: 2752,
  physics: 7250,
  pointer: 5078,
  ripple: 4249,
  scroll: 5920,
  "smooth-scroll": 1930,
  svg: 4953,
  text: 5444,
  transitions: 1755,
};
