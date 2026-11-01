import { ensureBlogPostsCollection } from "../collections/default-collections.js";
import { definePlugin } from "../plugins/plugin-definition.js";

/**
 * The blog: switching it on makes the Blog posts collection, with Categories and Tags.
 * Posts are ordinary entries, so everything else comes from content, delivery and search.
 */
export const blogPlugin = definePlugin({
  id: "blog",
  name: "Blog",
  description: "Posts, categories and tags.",
  createContent: ensureBlogPostsCollection,
});
