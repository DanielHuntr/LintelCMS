import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import type { DeliveredAsset } from "../fieldtypes/image-assets.js";
import { renderRichTextHtml, type RichTextDocument } from "../fieldtypes/rich-text.js";

/**
 * Turns stored field values into what a website wants to print. Most values are already
 * fine as they are; two fieldtypes are worth expanding:
 *
 *   - image:    the stored asset id becomes the asset itself (url, alt text, size, focal
 *               point), or null if the image has since been deleted;
 *   - richText: the editor's JSON is kept and its HTML added, as `{ json, html }`.
 *
 * Only the blueprint's fields are delivered, so values left behind by a removed field
 * never reach a website.
 */
export function deliverValues(
  fields: readonly FieldDefinition[],
  data: Readonly<Record<string, unknown>>,
  assets: ReadonlyMap<string, DeliveredAsset>,
): Record<string, unknown> {
  const delivered: Record<string, unknown> = {};
  for (const field of fields) {
    delivered[field.handle] = deliverValue(field, data[field.handle] ?? null, assets);
  }
  return delivered;
}

function deliverValue(
  field: FieldDefinition,
  value: unknown,
  assets: ReadonlyMap<string, DeliveredAsset>,
): unknown {
  if (value === null) {
    return null;
  }
  if (field.type === "image") {
    return typeof value === "string" ? (assets.get(value) ?? null) : null;
  }
  if (field.type === "richText") {
    return isRichTextDocument(value) ? { json: value, html: renderRichTextHtml(value) } : null;
  }
  return value;
}

/** Every image id used by these entries, once each, so they can be looked up together. */
export function collectImageIds(
  fields: readonly FieldDefinition[],
  dataList: readonly Readonly<Record<string, unknown>>[],
): string[] {
  const imageHandles = fields
    .filter((field) => field.type === "image")
    .map((field) => field.handle);
  const ids = new Set<string>();
  for (const data of dataList) {
    for (const handle of imageHandles) {
      const value = data[handle];
      if (typeof value === "string") {
        ids.add(value);
      }
    }
  }
  return [...ids];
}

function isRichTextDocument(value: unknown): value is RichTextDocument {
  return typeof value === "object" && value !== null && "type" in value && value.type === "doc";
}
