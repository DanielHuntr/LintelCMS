import type { BoundItem, BoundPicture, BoundValue } from "../data/bound-items.js";
import type { BlockProperty } from "./custom-block.js";

/**
 * Inside a block's design, node `bindings` point at the block's properties rather than an
 * entry's fields, so a block reuses what collection lists already do:
 *
 *   { "text": "name" }            the heading shows the Name property
 *   { "src": "photo" }            the picture shows the Photo property (and its description)
 *   { "href": "linkedin" }        the button goes where the LinkedIn property says
 *   { "visible": "show_badge" }   the element is shown only while the toggle is on
 *   { "style.color": "accent" }   a colour property sets one of its colours
 *   { "items": "people" }         its children are repeated once per row of a list property,
 *                                 and bindings inside them point at the row's fields
 */

/** Shows the element only while the property is on (a toggle) or filled in. */
export const visibleBinding = "visible";

/** Repeats the element's children for each row of a list (repeater) property. */
export const itemsBinding = "items";

/** `style.color`: a colour property sets this style. */
export const styleBindingPrefix = "style.";

/** The styles a colour property can set. */
export const bindableColourStyles = ["color", "backgroundColor", "borderColor"] as const;
export type BindableColourStyle = (typeof bindableColourStyles)[number];

export function isPropBinding(key: string): boolean {
  return key !== visibleBinding && key !== itemsBinding && !key.startsWith(styleBindingPrefix);
}

/** Which kinds of property a binding of each kind can use. */
export function propertyTypesFor(
  binding: "text" | "multilineText" | "image" | "link" | "visible" | "colour" | "items",
): readonly string[] {
  switch (binding) {
    case "text":
      return ["text", "slug", "email", "select", "radio", "buttonGroup", "number", "date", "time"];
    case "multilineText":
      return ["textarea", "text", "markdown", "select", "radio"];
    case "image":
      return ["image"];
    case "link":
      return ["link", "url", "email"];
    case "visible":
      return ["toggle", "revealer"];
    case "colour":
      return ["colour"];
    case "items":
      return ["repeater"];
  }
}

/** A row of a repeater property, as stored: `{ id, data }`. */
interface StoredRow {
  id: string;
  data: Record<string, unknown>;
}

export function readRows(value: unknown): StoredRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row, index): StoredRow[] => {
    if (typeof row !== "object" || row === null) return [];
    const { id, data } = row as { id?: unknown; data?: unknown };
    return [
      {
        id: typeof id === "string" && id !== "" ? id : String(index),
        data:
          typeof data === "object" && data !== null && !Array.isArray(data)
            ? (data as Record<string, unknown>)
            : {},
      },
    ];
  });
}

/** The fields a repeater property's rows have. */
export function rowProperties(property: BlockProperty | undefined): readonly BlockProperty[] {
  const fields = property?.options?.fields;
  return Array.isArray(fields) ? (fields as BlockProperty[]) : [];
}

/**
 * Values as the bound item an element reads, in the shapes `bindProps` understands: text,
 * a picture (from the media library, by asset id), a link's address. Empty values are left
 * out, so the design's own words and pictures show until an editor fills a property in.
 */
export function valuesAsItem(
  values: Readonly<Record<string, unknown>>,
  properties: readonly BlockProperty[],
  pictures: Readonly<Record<string, BoundPicture>> = {},
): BoundItem {
  const fields: Record<string, BoundValue> = {};
  for (const property of properties) {
    const value = displayValue(values[property.handle], property, pictures);
    if (value !== null) fields[property.handle] = value;
  }
  return { id: "block", fields };
}

/** What one value shows: null when there's nothing to show. */
export function displayValue(
  value: unknown,
  property: BlockProperty,
  pictures: Readonly<Record<string, BoundPicture>>,
): BoundValue {
  if (value === undefined || value === null) return null;
  switch (property.type) {
    case "image":
      return typeof value === "string" ? (pictures[value] ?? null) : null;
    case "link": {
      if (typeof value !== "object") return null;
      const url = (value as { url?: unknown }).url;
      return typeof url === "string" && url.trim() !== "" ? url : null;
    }
    case "toggle":
    case "revealer":
      return value === true ? "true" : null;
    default:
      if (Array.isArray(value)) {
        const words = value.filter((item) => typeof item === "string").join(", ");
        return words === "" ? null : words;
      }
      if (typeof value === "string") return value.trim() === "" ? null : value;
      if (typeof value === "number") return String(value);
      return null;
  }
}

/** Whether an element bound to this toggle (or filled-in property) is shown. */
export function isShown(value: unknown, property: BlockProperty | undefined): boolean {
  if (!property) return true;
  if (property.type === "toggle" || property.type === "revealer") {
    return value === undefined || value === null ? property.default !== false : value === true;
  }
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && value !== "";
}
