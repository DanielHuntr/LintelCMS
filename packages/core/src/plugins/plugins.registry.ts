import { blogPlugin } from "../blog/blog.plugin.js";
import { formsPlugin } from "../forms/forms.plugin.js";
import { seoPlugin } from "../seo/seo.plugin.js";
import { definePlugin } from "./plugin-definition.js";

/**
 * The online shop. For now only a name to switch on and off (the admin shows a Commerce
 * section saying what is coming); its routes and tables will be added to this definition.
 */
const commercePlugin = definePlugin({
  id: "commerce",
  name: "Online shop",
  description: "Products, orders and payments.",
});

/**
 * Every built-in plugin, in one visible list (no discovery by file names), in the order
 * Settings → Features and the setup screen show them. Each is a `definePlugin` from its
 * own feature folder. Plugins from packages are added after these, from lintel.config.ts
 * at the repository root (see installed-plugins.ts).
 */
export const pluginRegistry = [blogPlugin, commercePlugin, formsPlugin, seoPlugin] as const;

export type PluginId = (typeof pluginRegistry)[number]["id"];
