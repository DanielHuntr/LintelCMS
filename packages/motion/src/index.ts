/**
 * @lintel/motion: plays Lintel animation specs in the browser.
 *
 * This entry point has no dependencies and is safe to import during server rendering.
 * Validate specs on the server with `@lintel/motion/schema`; find ready-made ones in
 * `@lintel/motion/presets`.
 */
export { mountMotion, cloakAttribute } from "./runtime/mountMotion.js";
export type { MotionController, MountOptions } from "./runtime/mountMotion.js";
export { mountMotionList } from "./runtime/mountMotionList.js";
export type { MotionBinding, PageMotion } from "./runtime/mountMotionList.js";
export { motionCloakCss } from "./runtime/cloak.js";
export {
  mountEffect,
  readEffectContext,
  registerEffectBehaviour,
  setEffectModuleAddresses,
  startEffects,
} from "./effects/loadEffects.js";
export type {
  EffectBehaviour,
  EffectBinding,
  EffectCleanup,
  EffectContext,
  EffectModule,
  EffectModuleName,
  EffectParams,
  PageEffects,
  SiteEffectSettings,
} from "./effects/effect-types.js";
export type { ReducedMotionPreference } from "./runtime/environment.js";
export { reduceMotion } from "./reduced-motion/reducedMotion.js";
export {
  evaluateEasing,
  easingToCss,
  namedEasingHandles,
  settleDurationOf,
} from "./easing/easing.js";
export { sampleTrack } from "./keyframes/sampleTrack.js";
export { sceneProgress } from "./runtime/scrollScene.js";
export {
  propertyCatalogue,
  catalogueProperties,
  describeProperty,
  isCssVariable,
} from "./spec/properties.js";
export type { AnimatableProperty, CatalogueProperty, PropertyKind } from "./spec/properties.js";
export type {
  Easing,
  Keyframe,
  MotionSpec,
  MotionSpecInput,
  ReducedMotionBehaviour,
  ScrollMarker,
  ScrollTrigger,
  Targets,
  Track,
  Trigger,
  TriggerType,
} from "./spec/motion.schema.js";
