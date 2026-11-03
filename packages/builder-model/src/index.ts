// The public surface of @lintel/builder-model. Anything not exported here is internal.
export * from "./document/page-document.schema.js";
export {
  documentMigrations,
  migrateDocument,
  UnknownPageVersionError,
  type DocumentMigration,
} from "./document/migrations.js";
export {
  validatePageDocument,
  type PageCheckResult,
  type PageProblem,
} from "./document/validate-page.js";

export * from "./components/component-definition.js";
export * from "./components/component-props.js";
export {
  createComponentCatalogue,
  DuplicateComponentTypeError,
  standardCatalogue,
  standardComponents,
  type ComponentCatalogue,
} from "./components/component-catalogue.js";
export {
  codeBlockComponent,
  maxCodeLength,
  type CodeBlockProps,
} from "./components/code-block-component.js";
export * from "./components/layout-components.js";
export * from "./components/content-components.js";
export * from "./components/block-components.js";
export * from "./components/layout-more-components.js";
export * from "./components/media-components.js";
export * from "./components/info-components.js";
export * from "./components/site-navigation-components.js";
export * from "./components/form-components.js";
export * from "./components/collection-components.js";
export * from "./components/shop-components.js";
export * from "./components/effect-components.js";
export * from "./data/bound-items.js";
export * from "./custom-blocks/custom-block.js";
export * from "./custom-blocks/block-bindings.js";
export * from "./custom-blocks/expand-blocks.js";
export * from "./custom-blocks/block-template.js";
export * from "./custom-blocks/make-block.js";

export * from "./styles/style-properties.js";
export * from "./styles/style-cascade.js";
export { assignClassNames, slugifyClassName } from "./styles/class-names.js";
export { compileStatePreview, compileStylesheet, formatRule } from "./styles/compile-stylesheet.js";
export * from "./styles/style-values.js";
export * from "./styles/clip-shapes.js";
export * from "./styles/background-layers.js";
export * from "./styles/effect-values.js";
export * from "./tokens/design-tokens.js";

export * from "./free-layout/free-layout.js";
export * from "./free-layout/z-order.js";
export * from "./backgrounds/background-video.js";
export * from "./fonts/font-catalogue.js";
export * from "./fonts/page-fonts.js";
export * from "./text-marks/text-marks.js";
export * from "./countries/country-codes.js";

export * from "./tree/node-ids.js";
export * from "./tree/tree-queries.js";
export * from "./tree/tree-changes.js";
export { createNode, UnknownComponentError } from "./tree/create-node.js";

export * from "./html/html-parser.js";
export { escapeAttribute, escapeText, formatHtml, writeHtml } from "./html/html-writer.js";
export { importHtml, type HtmlImportOptions, type HtmlImportResult } from "./html/html-import.js";

export { findCodeMarkers, fillCodeMarkers, type CodeMarker } from "./code/code-markers.js";
export {
  customScriptRules,
  makeCssSafeToEmbed,
  makeScriptSafeToEmbed,
  removeScriptsFromHtml,
  type CustomScriptRule,
} from "./code/sanitise-code.js";
export { applyScriptRule, findChangedCode } from "./code/code-changes.js";

export {
  findSectionTemplate,
  sectionCategories,
  sectionTemplates,
  type SectionCategory,
  type SectionTemplate,
} from "./templates/section-templates.js";

export {
  buildStarterPage,
  formsUsedBy,
  type StarterPageOptions,
  type StarterPage,
  type StarterSite,
  type StarterTheme,
} from "./starter-sites/starter-site.js";
export { findStarterSite, starterSites } from "./starter-sites/starter-sites.js";
export { findIllustration, illustrationNames } from "./starter-sites/illustrations.js";
