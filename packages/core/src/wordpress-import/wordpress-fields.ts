import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";

/**
 * Which field of a collection's content type each part of a WordPress post goes into.
 * Found from the fields themselves: the title field, the first rich text field (preferring
 * one called "body"), a textarea called excerpt or summary, the first image field
 * (preferring featured_image or hero_image), and terms fields for the chosen taxonomies.
 * A part with nowhere to go is left out, and the mapping screen says so.
 */
export interface WordPressFieldMapping {
  title: string;
  body: string | null;
  excerpt: string | null;
  featuredImage: string | null;
  categories: string | null;
  tags: string | null;
}

export function findFieldMapping(
  fields: readonly FieldDefinition[],
  taxonomies: { categories: string | null; tags: string | null },
): WordPressFieldMapping {
  const ofType = (type: string) => fields.filter((field) => field.type === type);
  const preferred = (candidates: FieldDefinition[], handles: string[]) =>
    (candidates.find((field) => handles.includes(field.handle)) ?? candidates[0])?.handle ?? null;
  const termsFieldFor = (taxonomy: string | null) =>
    taxonomy === null
      ? null
      : (ofType("terms").find((field) => field.options.taxonomy === taxonomy)?.handle ?? null);

  return {
    title: "title",
    body: preferred(ofType("richText"), ["body", "content"]),
    excerpt:
      ofType("textarea").find((field) => ["excerpt", "summary"].includes(field.handle))?.handle ??
      null,
    featuredImage: preferred(ofType("image"), ["featured_image", "hero_image", "image"]),
    categories: termsFieldFor(taxonomies.categories),
    tags: termsFieldFor(taxonomies.tags),
  };
}
