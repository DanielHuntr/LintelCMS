import { definePlugin } from "../plugins/plugin-definition.js";
import { seoRoutes } from "./seo.routes.js";

/**
 * "SEO tools": page titles and descriptions, the sitemap, robots.txt and redirects.
 *
 * Its tables (`entry_seo`, `redirects`) are in Lintel's own migrations, because they were
 * there before plugins could bring their own, so the definition has no `database`.
 */
export const seoPlugin = definePlugin({
  id: "seo",
  name: "SEO tools",
  description: "Page titles, sitemaps and redirects.",
  routes: seoRoutes,
});
