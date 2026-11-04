import type { EffectModuleName } from "../effects/effect-types.js";

/**
 * What each effect module costs a page that uses it, gzipped, with the shared code it
 * imports. Measured by scripts/measure-effect-modules.mjs; a test checks it stays current.
 */
export const effectModuleBytes: Record<EffectModuleName, number> = {
  cursor: 7710,
  depth: 7226,
  "film-grain": 1990,
  "frosted-glass": 3091,
  "image-distort": 6674,
  intro: 2844,
  "liquid-gradient": 5919,
  lottie: 3231,
  marquee: 3209,
  model: 4871,
  particles: 2860,
  physics: 7357,
  "picture-effects": 7691,
  playground: 4773,
  pointer: 5251,
  ripple: 4389,
  rive: 2734,
  scroll: 6022,
  "shader-backgrounds": 8050,
  "smooth-scroll": 2038,
  svg: 5059,
  text: 5549,
  transitions: 1864,
};

/**
 * What a page also downloads, gzipped, once such an element nears the screen: the player
 * and, for Rive, its WebAssembly, or three.js for a 3D model. Kept apart from the modules,
 * which stay small. A model's own file is counted from the page.
 */
export const effectPlayerBytes: Partial<Record<EffectModuleName, number>> = {
  lottie: 49178,
  model: 159187,
  rive: 414602,
};
