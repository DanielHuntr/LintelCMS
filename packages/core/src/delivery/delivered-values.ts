import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import type { DeliveredAsset } from "../fieldtypes/image-assets.js";
import { renderMarkdownHtml } from "../fieldtypes/markdown.js";
import { renderRichTextHtml, type RichTextDocument } from "../fieldtypes/rich-text.js";
import { eachBlock } from "./block-values.js";
import { type DeliveredReferences, noDeliveredReferences } from "./delivered-references.js";

/**
 * Turns stored field values into what a website wants to print. Most values are already
 * fine as they are; three fieldtypes are worth expanding:
 *
 *   - image:    the stored asset id becomes the asset itself (url, alt text, size, focal
 *               point), or null if the image has since been deleted;
 *   - richText: the editor's JSON is kept and its HTML added, as `{ json, html }`;
 *   - blocks:   an ordered array of `{ id, type, data }`, each block's `data` delivered by
 *               these same rules against its block type's fields.
 *
 * and three more are expanded the same way:
 *
 *   - markdown: the text is kept and its HTML added, as `{ markdown, html }`;
 *   - terms:    the stored ids become `{ id, title, slug, taxonomy }`;
 *   - entries:  the stored ids become links to the published entries (see
 *               delivered-references.ts); unpublished ones are left out.
 *
 * Only the blueprint's fields are delivered, so values left behind by a removed field
 * (or blocks of a removed block type) never reach a website.
 */
export function deliverValues(
  fields: readonly FieldDefinition[],
  data: Readonly<Record<string, unknown>>,
  assets: ReadonlyMap<string, DeliveredAsset>,
  references: DeliveredReferences = noDeliveredReferences,
): Record<string, unknown> {
  const delivered: Record<string, unknown> = {};
  for (const field of fields) {
    delivered[field.handle] = deliverValue(field, data[field.handle] ?? null, assets, references);
  }
  return delivered;
}

function deliverValue(
  field: FieldDefinition,
  value: unknown,
  assets: ReadonlyMap<string, DeliveredAsset>,
  references: DeliveredReferences,
): unknown {
  if (value === null) {
    return null;
  }
  if (field.type === "markdown") {
    return typeof value === "string" ? { markdown: value, html: renderMarkdownHtml(value) } : null;
  }
  if (field.type === "terms") {
    return listedValues(value, references.terms);
  }
  if (field.type === "entries") {
    return listedValues(value, references.entries);
  }
  if (field.type === "image") {
    return typeof value === "string" ? (assets.get(value) ?? null) : null;
  }
  if (field.type === "richText") {
    return isRichTextDocument(value) ? { json: value, html: renderRichTextHtml(value) } : null;
  }
  if (field.type === "blocks") {
    return eachBlock(field, value).map(({ block, blockType }) => ({
      id: block.id,
      type: block.type,
      data: deliverValues(blockType.fields, block.data, assets, references),
    }));
  }
  return value;
}

/** Every image id used by these entries, inside blocks too, once each, to look up together. */
export function collectImageIds(
  fields: readonly FieldDefinition[],
  dataList: readonly Readonly<Record<string, unknown>>[],
): string[] {
  const ids = new Set<string>();
  for (const data of dataList) {
    addImageIds(fields, data, ids);
  }
  return [...ids];
}

function addImageIds(
  fields: readonly FieldDefinition[],
  data: Readonly<Record<string, unknown>>,
  ids: Set<string>,
): void {
  for (const field of fields) {
    const value = data[field.handle];
    if (field.type === "image" && typeof value === "string") {
      ids.add(value);
    }
    if (field.type === "blocks") {
      for (const { block, blockType } of eachBlock(field, value)) {
        addImageIds(blockType.fields, block.data, ids);
      }
    }
  }
}

/** The looked-up values for a list of ids, in the stored order, without any that are gone. */
function listedValues<Value>(value: unknown, found: ReadonlyMap<string, Value>): Value[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((id) => {
    const match = typeof id === "string" ? found.get(id) : undefined;
    return match === undefined ? [] : [match];
  });
}

function isRichTextDocument(value: unknown): value is RichTextDocument {
  return typeof value === "object" && value !== null && "type" in value && value.type === "doc";
}
