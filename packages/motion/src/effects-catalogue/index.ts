/**
 * @lintel/motion/effects: the Effects library. The definitions the builder's gallery
 * offers, `defineEffect` for adding your own, the site-wide settings, and turning saved
 * effects into what a published page runs. Uses Zod, so it's for the server and the
 * editor; published pages only load the small runtime and the modules they use.
 */
export {
  defineEffect,
  defaultProps,
  cleanProps,
  effectAnimation,
  effectColourPattern,
  effectCategories,
  elementKinds,
  InvalidEffectError,
} from "./effect-definition.js";
export type {
  AnimationEffect,
  BehaviourEffect,
  EffectCategory,
  EffectDefinition,
  EffectParameter,
  EffectParameters,
  EffectProps,
  EffectWeight,
  ElementKind,
  StyleEffect,
} from "./effect-definition.js";
export { number, choice, colour, toggle, text } from "./parameters.js";
export { standardEffects } from "./catalogue/index.js";
export {
  dragPlaygroundEffectId,
  lottiePlayerEffectId,
  rivePlayerEffectId,
} from "./catalogue/creative-effects.js";
export {
  cursorOverEffectId,
  cursorWordEffectId,
  hoverPictureEffectId,
} from "./catalogue/cursor-effects.js";
export { createEffectRegistry, effectRegistry, registerEffect } from "./effect-registry.js";
export type { EffectRegistry } from "./effect-registry.js";
export { nodeEffectSchema, nodeEffectsSchema, maxEffectsPerElement } from "./node-effect.schema.js";
export type { NodeEffect } from "./node-effect.schema.js";
export { resolveNodeEffects, effectSelector } from "./resolve-effects.js";
export type { ResolvedEffects } from "./resolve-effects.js";
export { measurePageWeight } from "./page-weight.js";
export type { PageWeight, PageWeightWarning } from "./page-weight.js";
export { effectModuleBytes } from "./module-sizes.js";
export {
  siteEffectSettingsSchema,
  defaultSiteEffectSettings,
  hasSiteEffects,
} from "./site-effects.js";
export {
  pageTransitionLooks,
  pageTransitionSpeeds,
  nearestPageTransitionSpeed,
  pageTransitionCss,
  keyframesCss,
  carriedElementsScript,
} from "./page-transition-looks.js";
export type {
  PageTransitionLook,
  PageTransitionSpeed,
  LookKeyframe,
} from "./page-transition-looks.js";
export {
  introMarkup,
  introCss,
  introSeenScript,
  introWords,
  INTRO_LONGEST_MILLISECONDS,
  INTRO_SHORTEST_MILLISECONDS,
  introCount,
  introLeavingKeyframes,
} from "./site-intro.js";
export type { IntroContent } from "./site-intro.js";
export { effectModuleNames } from "../effects/effect-types.js";
export type {
  EffectBinding,
  EffectBehaviour,
  EffectContext,
  EffectModuleName,
  EffectParams,
  PageEffects,
  SiteEffectSettings,
  CursorSettings,
  CursorWordLook,
  CursorPicture,
} from "../effects/effect-types.js";
export {
  cursorColourCss,
  cursorIsOn,
  cursorPictureAddress,
  cursorWordColourPattern,
  cursorWordCss,
  cursorWordVariables,
  defaultCursorPicture,
  defaultCursorWordLook,
  largeCursorPictureBytes,
  lettersOnHex,
  safePictureAddress,
} from "../effects/kit/cursor-look.js";
export { drawTrail, type TrailPoint } from "../effects/kit/cursor-trail.js";
