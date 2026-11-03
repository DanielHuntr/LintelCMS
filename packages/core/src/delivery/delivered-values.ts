import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import type { DeliveredAsset } from "../fieldtypes/image-assets.js";
import { renderMarkdownHtml } from "../fieldtypes/markdown.js";
import { readPageLinkId, resolvePageLinks } from "@lintel/builder-model";
import {
  renderRichTextHtml,
  resolveRichText,
  type RichTextDocument,
  type RichTextLookups,
  richTextAssetIds,
} from "../fieldtypes/rich-text.js";
import type { FieldsOptions } from "../fieldtypes/container-fieldtypes.js";
import { findFieldtype } from "../fieldtypes/fieldtypes.registry.js";
import { describeVideoAddress } from "../fieldtypes/video-addresses.js";
import { eachBlock, eachRow, innerValueSets } from "./block-values.js";
import { type DeliveredReferences, noDeliveredReferences } from "./delivered-references.js";

/**
 * Turns stored field values into what a website wants to print. Most values are already
 * fine as they are; three fieldtypes are worth expanding:
 *
 *   - image:    the stored asset id becomes the asset itself (url, alt text, size, focal
 *               point), or null if the image has since been deleted;
 *   - richText: the editor's JSON is kept and its HTML added, as `{ json, html }`. Its
 *               pictures carry their `image`, as image fields do;
 *   - blocks:   an ordered array of `{ id, type, data }`, each block's `data` delivered by
 *               these same rules against its block type's fields.
 *
 * and more are expanded the same way:
 *
 *   - markdown: the text is kept and its HTML added, as `{ markdown, html }`;
 *   - terms:    the stored ids become `{ id, title, slug, taxonomy }`;
 *   - entries:  the stored ids become links to the published entries (see
 *               delivered-references.ts); unpublished ones are left out;
 *   - users:    the stored ids become `{ id, name }`;
 *   - video:    the address becomes `{ url, provider, embedUrl }`;
 *   - link:     a link to a page by its id gets the page's address now, as `{ url, label,
 *               entryId }`, or null when the page is gone;
 *   - page:     a page's design, with links to pages swapped for their addresses;
 *   - group, fieldset: their values, delivered by these same rules;
 *   - repeater: `[{ id, data }]`, each row's `data` delivered by these same rules.
 *
 * Links to pages by id (`lintel:page/<id>`, see docs/decisions/0032) never reach a website:
 * a link to a page that is gone or not live becomes plain words, or no link at all.
 *
 * Only the blueprint's fields are delivered, so values left behind by a removed field
 * (or blocks of a removed block type) never reach a website. Fields that only arrange the
 * editor (sections, spacers, tabs, Show more buttons) are left out too.
 */
export function deliverValues(
  fields: readonly FieldDefinition[],
  data: Readonly<Record<string, unknown>>,
  assets: ReadonlyMap<string, DeliveredAsset>,
  references: DeliveredReferences = noDeliveredReferences,
): Record<string, unknown> {
  const delivered: Record<string, unknown> = {};
  for (const field of fields) {
    if (!isDelivered(field)) {
      continue;
    }
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
  if (field.type === "users") {
    return listedValues(value, references.users);
  }
  if (field.type === "video") {
    const video = typeof value === "string" ? describeVideoAddress(value) : null;
    return video ? { url: value, ...video } : null;
  }
  if (field.type === "group" || field.type === "fieldset") {
    const [inner] = innerValueSets(field, value);
    return inner ? deliverValues(inner.fields, inner.data, assets, references) : null;
  }
  if (field.type === "repeater") {
    const { fields = [] } = field.options as Partial<FieldsOptions>;
    return eachRow(value).map((row) => ({
      id: row.id,
      data: deliverValues(fields, row.data ?? {}, assets, references),
    }));
  }
  if (field.type === "image") {
    return typeof value === "string" ? (assets.get(value) ?? null) : null;
  }
  if (field.type === "richText") {
    if (!isRichTextDocument(value)) return null;
    const lookups = richTextLookups(assets, references);
    return { json: resolveRichText(value, lookups), html: renderRichTextHtml(value, lookups) };
  }
  if (field.type === "link") {
    return deliverLink(value, references);
  }
  if (field.type === "page") {
    return resolvePageLinks(value, (entryId) => pageAddress(entryId, references));
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

function pageAddress(entryId: string, references: DeliveredReferences): string | null {
  return references.pages.get(entryId)?.url ?? null;
}

function richTextLookups(
  assets: ReadonlyMap<string, DeliveredAsset>,
  references: DeliveredReferences,
): RichTextLookups {
  return {
    pageAddress: (entryId) => pageAddress(entryId, references),
    picture: (assetId) => assets.get(assetId) ?? null,
  };
}

/** A Link field: a link to a page by its id gets the page's address, or is gone with it. */
function deliverLink(value: unknown, references: DeliveredReferences): unknown {
  if (typeof value !== "object" || value === null || !("url" in value)) return value;
  const entryId = readPageLinkId(value.url);
  if (!entryId) return value;
  const url = pageAddress(entryId, references);
  return url === null ? null : { ...value, url, entryId };
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
    if (field.type === "richText" && isRichTextDocument(value)) {
      richTextAssetIds(value).forEach((id) => ids.add(id));
    }
    for (const inner of innerValueSets(field, value)) {
      addImageIds(inner.fields, inner.data, ids);
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

/** Whether a field's value reaches websites: not for fields that only arrange the editor. */
export function isDelivered(field: FieldDefinition): boolean {
  const fieldtype = findFieldtype(field.type);
  return (fieldtype?.holdsValue ?? true) && field.type !== "revealer";
}
