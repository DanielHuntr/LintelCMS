// The renderer on its own, for the server and the site: no editor code comes with it.
export {
  createComponentRegistry,
  drawsProps,
  MissingRenderError,
  type ComponentRegistry,
  type ComponentRegistryEntry,
  type ComponentRender,
  type ElementAttributes,
  type RenderMode,
  type RenderProps,
} from "./component-registry.js";
export { renderPage, type RenderedPage, type RenderOptions } from "./render-page.js";
export { standardRegistry, standardRenders, standInRenders } from "./stand-in-components.js";
export { paragraphsHtml, siteBlockRenders } from "./site-blocks.js";
export { standInBaseStylesheet } from "./base-stylesheet.js";
export { collectAnimations, type PageAnimation } from "./page-animations.js";
export { designBaseStylesheet, designClassName } from "./design-stylesheet.js";
