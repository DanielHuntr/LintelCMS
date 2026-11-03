import { definePlugin } from "../plugins/plugin-definition.js";
import { pageDraftsRoutes } from "./page-drafts.routes.js";

/**
 * "Page drafting": a writing model running on this server drafts a page from a short
 * description, or rewrites a heading or paragraph. Off until someone switches it on in
 * Build → Features, and then it does nothing until an admin downloads the model in
 * Settings → Page drafting. Nothing is ever sent to another service while it works.
 * Why it works this way: docs/decisions/0043-page-drafting.md.
 */
export const pageDraftsPlugin = definePlugin({
  id: "drafts",
  name: "Page drafting",
  description:
    "Draft a page from a short description, with a writing model that runs on your own server.",
  permissions: [
    {
      permission: "drafts:use",
      name: "Draft pages and rewrite text",
      description: "Use “Draft a page for me” and “Rewrite this” in the page builder.",
    },
  ],
  routes: pageDraftsRoutes,
});
