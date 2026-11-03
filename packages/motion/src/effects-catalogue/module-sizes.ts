import type { EffectModuleName } from "../effects/effect-types.js";

/**
 * What each effect module costs a page that uses it, gzipped, with the shared code it
 * imports. Measured by scripts/measure-effect-modules.mjs; a test checks it stays current.
 */
export const effectModuleBytes: Record<EffectModuleName, number> = {
  cursor: 7583,
  depth: 5077,
  "frosted-glass": 4093,
  "image-distort": 4566,
  intro: 2591,
  "liquid-gradient": 4839,
  lottie: 3158,
  marquee: 3135,
  particles: 2789,
  physics: 7281,
  playground: 4698,
  pointer: 5178,
  ripple: 4289,
  rive: 2495,
  scroll: 4759,
  "smooth-scroll": 1962,
  svg: 4986,
  text: 5476,
  transitions: 1786,
};

/**
 * What a page also downloads, gzipped, once such an element nears the screen: the player
 * and, for Rive, its WebAssembly. Kept apart from the modules, which stay small.
 */
export const effectPlayerBytes: Partial<Record<EffectModuleName, number>> = {
  lottie: 49178,
  rive: 414602,
};
