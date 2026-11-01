import type { DatabaseOrTransaction } from "../database/client.js";
import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import {
  categoriesTaxonomy,
  ensureBlogTaxonomies,
  tagsTaxonomy,
} from "../taxonomies/default-taxonomies.js";
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

/**
 * The page builder every new site's pages start with: the sections most small-business
 * pages are made of. Agencies can add, change or remove block types in Content types.
 */
const pageSectionsField = field("sections", "Page sections", "blocks", {
  helpText: "Build the page from sections. Drag them, or use the arrows, to change the order.",
  options: {
    blockTypes: [
      {
        handle: "hero",
        name: "Hero",
        description: "A big heading at the top of the page, with an optional picture and button.",
        fields: [
          field("heading", "Heading", "text", { required: true }),
          field("subheading", "Subheading", "textarea"),
          field("image", "Background image", "image"),
          field("button", "Button", "link"),
        ],
      },
      {
        handle: "text",
        name: "Text",
        description: "Paragraphs, lists and subheadings.",
        fields: [
          field("heading", "Heading", "text"),
          field("body", "Text", "richText", { required: true }),
        ],
      },
      {
        handle: "image",
        name: "Image",
        description: "A picture across the page, with an optional caption.",
        fields: [
          field("image", "Image", "image", { required: true }),
          field("caption", "Caption", "text"),
        ],
      },
      {
        handle: "call_to_action",
        name: "Call to action",
        description: "A short invitation with a button, such as “Book a call”.",
        fields: [
          field("heading", "Heading", "text", { required: true }),
          field("text", "Text", "textarea"),
          field("button", "Button", "link", { required: true }),
        ],
      },
      {
        handle: "faq",
        name: "FAQ",
        description: "One question and its answer. Add one for each question.",
        fields: [
          field("question", "Question", "text", { required: true }),
          field("answer", "Answer", "richText", { required: true }),
        ],
      },
    ],
  },
});

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
      pageSectionsField,
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
      field("categories", "Categories", "terms", {
        options: { taxonomy: categoriesTaxonomy.handle, maxItems: 3 },
      }),
      field("tags", "Tags", "terms", { options: { taxonomy: tagsTaxonomy.handle } }),
    ],
  },
};

export function ensurePagesCollection(database: DatabaseOrTransaction): Promise<void> {
  return ensureCollection(database, pagesCollection);
}

/** Blog posts, and the Categories and Tags their fields choose from. */
export async function ensureBlogPostsCollection(database: DatabaseOrTransaction): Promise<void> {
  await ensureBlogTaxonomies(database);
  await ensureCollection(database, blogPostsCollection);
}
