import type { Blueprint } from "../content-types/blueprints.types.js";
import type { Collection, Entry } from "./content.types.js";

/** Sample content for the content tests, shaped exactly like the API's responses. */

export const postBlueprint: Blueprint = {
  id: "b2",
  handle: "post",
  name: "Blog post",
  kind: "entry",
  version: 1,
  updatedAt: "2026-10-01T09:00:00.000Z",
  fields: [
    { handle: "title", label: "Title", type: "text", required: true, options: {} },
    { handle: "excerpt", label: "Excerpt", type: "textarea", required: true, options: {} },
    {
      handle: "category",
      label: "Category",
      type: "select",
      required: true,
      options: { choices: [{ value: "news", label: "News" }] },
    },
  ],
};

export const postsCollection: Collection = {
  id: "c2",
  handle: "posts",
  name: "Blog posts",
  blueprintHandle: "post",
  structure: "dated",
  routePattern: "/blog/{slug}",
  previewUrlPattern: null,
  allowedAtRoot: true,
  allowedChildren: [],
  childrenAsCollection: false,
  entryCount: 1,
  updatedAt: "2026-10-01T09:00:00.000Z",
};

export function samplePost(overrides: Partial<Entry> = {}): Entry {
  return {
    id: "p1",
    title: "Hello world",
    slug: "hello-world",
    status: "draft",
    parentId: null,
    locale: "en-GB",
    originId: null,
    updatedAt: "2026-10-01T09:00:00.000Z",
    publishedAt: null,
    scheduledFor: null,
    updatedBy: { id: "u1", name: "Ada Lovelace" },
    version: 1,
    collectionHandle: "posts",
    data: { title: "Hello world", excerpt: "", category: null },
    blueprint: postBlueprint,
    hasUnpublishedChanges: false,
    translations: [],
    ...overrides,
  };
}
