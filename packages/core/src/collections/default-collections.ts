import type { DatabaseOrTransaction } from "../database/client.js";
import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import { type CollectionDefaults, ensureCollection } from "./collections.service.js";

/**
 * The content every new site starts with. Setup makes sure Pages exist; switching on the
 * blog plugin makes sure Blog posts exist (see src/setup and src/plugins). Both are safe
 * to run again, and switching a plugin off never deletes what it created.
 */

function field(
  handle: string,
  label: string,
  type: string,
  extra: Partial<Pick<FieldDefinition, "required" | "helpText" | "options">> = {},
): FieldDefinition {
  return { handle, label, type, required: false, helpText: "", options: {}, ...extra };
}

const titleField = field("title", "Title", "text", { required: true });

export const pagesCollection: CollectionDefaults = {
  handle: "pages",
  name: "Pages",
  structure: "tree",
  routePattern: "/{slug}",
  blueprint: {
    handle: "page",
    name: "Page",
    fields: [
      titleField,
      field("summary", "Summary", "textarea", {
        helpText: "A sentence or two for search results and link previews",
      }),
      field("hero_image", "Hero image", "image", { helpText: "Shown at the top of the page" }),
      field("body", "Body", "richText"),
    ],
  },
};

export const blogPostsCollection: CollectionDefaults = {
  handle: "posts",
  name: "Blog posts",
  structure: "dated",
  routePattern: "/blog/{slug}",
  blueprint: {
    handle: "post",
    name: "Blog post",
    fields: [
      titleField,
      field("excerpt", "Excerpt", "textarea", {
        helpText: "Shown in lists of posts and in link previews",
      }),
      field("featured_image", "Featured image", "image"),
      field("body", "Body", "richText"),
      field("category", "Category", "select", {
        options: {
          choices: [
            { value: "news", label: "News" },
            { value: "guides", label: "Guides" },
            { value: "updates", label: "Updates" },
          ],
          multiple: false,
        },
      }),
    ],
  },
};

export function ensurePagesCollection(database: DatabaseOrTransaction): Promise<void> {
  return ensureCollection(database, pagesCollection);
}

export function ensureBlogPostsCollection(database: DatabaseOrTransaction): Promise<void> {
  return ensureCollection(database, blogPostsCollection);
}
