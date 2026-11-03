import type { SourceField, SourceFieldKind } from "./source-site.js";

/**
 * Which Lintel field each kind of field from another system becomes, when the import
 * makes a new content type, and which existing fields one can go into. Kinds without an
 * equal (Webflow's multi-image field) get the closest thing: a repeater of pictures.
 */
export interface ImportedFieldDefinition {
  handle: string;
  label: string;
  type: string;
  options: Record<string, unknown>;
}

const fieldtypeFor: Record<SourceFieldKind, string> = {
  text: "text",
  textarea: "textarea",
  richText: "richText",
  markdown: "markdown",
  number: "number",
  toggle: "toggle",
  date: "date",
  image: "image",
  images: "repeater",
  url: "url",
  email: "email",
  colour: "colour",
  select: "select",
  terms: "terms",
  entries: "entries",
  code: "code",
  video: "video",
  list: "list",
  design: "page",
};

/** The fieldtypes an existing field may have to take each kind. */
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

/** "Hero image" or "hero-image" → `hero_image`; handles start with a letter. */
export function fieldHandle(text: string): string {
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

/**
 * The field to make for a source field going into a new content type. `taxonomyHandle`
 * and `collectionHandles` say where terms and entries fields point; without them those
 * fields can't be made and null is returned.
 */
export function defineImportedField(
  field: SourceField,
  handle: string,
  links: { taxonomyHandle?: string | null; collectionHandles?: string[] },
): ImportedFieldDefinition | null {
  const type = fieldtypeFor[field.kind];
  const label = field.label.trim().slice(0, 100) || handle;
  const base = { handle, label, type };
  switch (field.kind) {
    case "select": {
      const choices = [...new Set((field.choices ?? []).filter((choice) => choice.trim()))]
        .slice(0, 200)
        .map((choice) => ({ value: choice.slice(0, 100), label: choice.slice(0, 100) }));
      if (choices.length === 0) {
        return { ...base, type: "text", options: {} };
      }
      return { ...base, options: { choices, ...(field.multiple ? { multiple: true } : {}) } };
    }
    case "terms":
      return links.taxonomyHandle ? { ...base, options: { taxonomy: links.taxonomyHandle } } : null;
    case "entries":
      return {
        ...base,
        options: links.collectionHandles?.length ? { collections: links.collectionHandles } : {},
      };
    case "images":
      return {
        ...base,
        options: {
          fields: [{ handle: "picture", label: "Picture", type: "image", options: {} }],
          addLabel: "Add a picture",
        },
      };
    case "code":
      return { ...base, options: { language: "html" } };
    default:
      return { ...base, options: {} };
  }
}
