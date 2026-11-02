import type { EntryData, Field } from "../fields/field.types.js";

/**
 * The fields a page's design takes the place of on the website. Once the `design` field has
 * anything in it, the website draws the design instead of the page's Body and sections (see
 * core's website/entry-designs.service.ts); the summary and image still describe the page in
 * lists and search results, so they stay.
 */
const REPLACED_BY_DESIGN = ["body", "sections", "blocks"];

export function fieldsReplacedByDesign(fields: readonly Field[], data: EntryData): Set<string> {
  if (!hasDesign(data.design)) return new Set();
  return new Set(
    fields.map((field) => field.handle).filter((handle) => REPLACED_BY_DESIGN.includes(handle)),
  );
}

function hasDesign(value: unknown): boolean {
  if (typeof value !== "object" || value === null || !("root" in value)) return false;
  const root: unknown = value.root;
  if (typeof root !== "object" || root === null || !("children" in root)) return false;
  return Array.isArray(root.children) && root.children.length > 0;
}
