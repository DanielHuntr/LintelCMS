import { analyticsPlugin } from "../analytics/analytics.plugin.js";
import { blogPlugin } from "../blog/blog.plugin.js";
import { commercePlugin } from "../commerce/commerce.plugin.js";
import { formsPlugin } from "../forms/forms.plugin.js";
import { freePhotosPlugin } from "../free-photos/free-photos.plugin.js";
import { seoPlugin } from "../seo/seo.plugin.js";
import { automationsPlugin } from "../workflows/automations.plugin.js";

/**
 * Every built-in plugin, in one visible list (no discovery by file names), in the order
 * Build → Features and the setup screen show them. Each is a `definePlugin` from its
 * own feature folder. Plugins from packages are added after these, from lintel.config.ts
 * at the repository root (see installed-plugins.ts).
 */
export const pluginRegistry = [
  blogPlugin,
  commercePlugin,
  formsPlugin,
  automationsPlugin,
  seoPlugin,
  freePhotosPlugin,
  analyticsPlugin,
] as const;

export type PluginId = (typeof pluginRegistry)[number]["id"];
