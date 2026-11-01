import type { SourceFieldKind } from "./siteImport.api.js";

/**
 * Which existing fields can take each kind of field from another site, the same list the
 * API checks (packages/core/src/importers/imported-fields.ts), so the mapping screen only
 * offers fields that will be accepted.
 */
const compatible: Record<SourceFieldKind, readonly string[]> = {
  text: ["text", "textarea", "slug", "markdown"],
  textarea: ["textarea", "text", "markdown", "richText"],
  richText: ["richText", "markdown", "textarea"],
  markdown: ["markdown", "richText", "textarea"],
  number: ["number", "range", "text"],
  toggle: ["toggle"],
  date: ["date", "text"],
  image: ["image"],
  images: ["repeater", "image"],
  url: ["url", "link", "text", "video"],
  email: ["email", "text"],
  colour: ["colour", "text"],
  select: ["select", "radio", "buttonGroup", "checkboxes", "text"],
  terms: ["terms"],
  entries: ["entries"],
  code: ["code", "textarea"],
  video: ["video", "url", "text"],
  list: ["list", "checkboxes", "textarea"],
  design: ["page"],
};

export function canGoInto(kind: SourceFieldKind, fieldtype: string): boolean {
  return compatible[kind].includes(fieldtype);
}

/** "Hero image" → `hero_image`, as the API makes new fields' handles. */
export function handleFor(text: string): string {
  const handle = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return /^[a-z]/.test(handle) ? handle : `field_${handle}`.replace(/_+$/, "");
}
