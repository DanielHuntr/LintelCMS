// The public surface of @lintel/builder: the editor. The renderer alone is `@lintel/builder/render`.
export { PageBuilder, type PageBuilderProps } from "./PageBuilder.js";
export type { ImagePicker, PickedImage } from "./panels/content-fields.js";
export type { FileUploader, UploadedFile } from "./style-panel/design-tools.js";
export { builderStrings, type BuilderStringKey } from "./i18n/builder-strings.js";
export type { Translate } from "./i18n/builder-text.js";
export * from "./render/index.js";
export type { CanvasScriptAddresses, CanvasSite } from "./canvas/canvas-frame-script.js";
export {
  browserPreferenceStore,
  createMemoryPreferenceStore,
  type PreferenceStore,
} from "./preferences/builder-preferences.js";
export { skillLevels, type SkillLevel } from "./skill-level/skill-levels.js";
export { BlueprintSketch } from "./panels/BlueprintSketch.js";
