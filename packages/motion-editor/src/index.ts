/**
 * @lintel/motion-editor: the animation studio, as React components the builder embeds.
 *
 * Styles are Tailwind classes using the admin's design tokens, so the host must include this
 * package's source in its Tailwind build (the admin does, in src/styles.css).
 */
export { MotionStudio } from "./studio/MotionStudio.js";
export type { MotionStudioProps, StudioView } from "./studio/MotionStudio.js";
export type { OpenGroups } from "./controls/CollapsibleGroup.js";
export { PresetGallery } from "./gallery/PresetGallery.js";
export { PreviewSample } from "./preview/PreviewSample.js";
export { EasingEditor } from "./easing-editor/EasingEditor.js";
export { TimelineEditor } from "./timeline/TimelineEditor.js";
export { TriggerPicker } from "./trigger/TriggerPicker.js";
export { ScrollSceneEditor } from "./trigger/ScrollSceneEditor.js";
export { TranslateProvider } from "./strings/translate.js";
export type { Translate } from "./strings/translate.js";
export { motionEditorStrings } from "./strings/motionEditorStrings.js";
export type { MotionEditorStringKey } from "./strings/motionEditorStrings.js";
export { EffectsPanel } from "./effects/EffectsPanel.js";
export type { EffectsPanelProps } from "./effects/EffectsPanel.js";
export { EffectsGallery } from "./effects/EffectsGallery.js";
export { PageWeightMeter, formatKilobytes } from "./effects/PageWeightMeter.js";
export { SiteMotionSettings } from "./effects/SiteMotionSettings.js";
export { MotionPanel } from "./motion-panel/MotionPanel.js";
export { SceneElementsContext } from "./trigger/sceneElements.js";
export type { SceneElement } from "./trigger/sceneElements.js";
export type { MotionPanelProps, SavedAnimation } from "./motion-panel/MotionPanel.js";
export { listMotionChoices, searchMotionChoices } from "./motion-panel/motionChoices.js";
export type { MotionChoice, MotionMoment } from "./motion-panel/motionChoices.js";
