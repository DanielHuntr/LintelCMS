import type { BlockProperty, CustomBlock, PageNode } from "@lintel/builder-model";
import { apiRequest } from "../api/client.js";
import type { Field } from "../fields/field.types.js";

/** One of the site's own blocks, as the API sends it (see packages/core/src/blocks). */
export interface SiteBlock {
  id: string;
  handle: string;
  name: string;
  icon: string;
  category: string;
  description: string;
  source: "site" | "code" | "plugin";
  properties: Field[];
  design: PageNode | null;
  template: string | null;
  renamedProperties: Record<string, string>;
  version: number;
  /** Made in the builder, so it can be changed here. */
  editable: boolean;
  usedOn: BlockPageUse[];
  usedIn: string[];
  updatedAt: string;
}

export interface BlockPageUse {
  entryId: string;
  title: string;
  collection: string;
}

export interface BlockChanges {
  name: string;
  icon: string;
  category: string;
  description: string;
  properties: Field[];
  design: PageNode;
  renamedProperties?: Record<string, string>;
  confirmRemovals?: boolean;
}

/** Calls to the API's block routes. One function per route. */

export async function listBlocks(): Promise<SiteBlock[]> {
  const { blocks } = await apiRequest<{ blocks: SiteBlock[] }>("/blocks");
  return blocks;
}

const blockPath = (handle: string) => `/blocks/${encodeURIComponent(handle)}`;

export function getBlock(handle: string): Promise<SiteBlock> {
  return apiRequest<SiteBlock>(blockPath(handle));
}

export function createBlock(
  block: Omit<BlockChanges, "renamedProperties" | "confirmRemovals" | "description"> & {
    description?: string;
  },
): Promise<SiteBlock> {
  return apiRequest<SiteBlock>("/blocks", { method: "POST", body: block });
}

export function updateBlock(handle: string, changes: BlockChanges): Promise<SiteBlock> {
  return apiRequest<SiteBlock>(blockPath(handle), { method: "PUT", body: changes });
}

/** `convert` turns every instance into plain elements first, so pages look the same. */
export function deleteBlock(handle: string, convert: boolean): Promise<void> {
  return apiRequest<void>(`${blockPath(handle)}${convert ? "?convert=true" : ""}`, {
    method: "DELETE",
  });
}

/** Blocks the server draws (React blocks in code), for the canvas and previews. */
export async function renderBlocks(
  instances: ReadonlyArray<{ id: string; block: string; values: Record<string, unknown> }>,
): Promise<Record<string, string>> {
  if (instances.length === 0) return {};
  const { html } = await apiRequest<{ html: Record<string, string> }>("/blocks/render", {
    method: "POST",
    body: { instances },
  });
  return html;
}

/** The block as the builder and the renderer use it. */
export function asCustomBlock(block: SiteBlock): CustomBlock {
  return {
    handle: block.handle,
    name: block.name,
    icon: block.icon,
    category: block.category,
    description: block.description,
    source: block.source,
    properties: fieldsAsProperties(block.properties),
    design: block.design,
    template: block.template,
    renamedProperties: block.renamedProperties,
  };
}

/**
 * The admin's fields as a block's properties: the same field definitions, typed for the page
 * model, which reads their options as plain values.
 */
export function fieldsAsProperties(fields: readonly Field[]): BlockProperty[] {
  return fields.map((field) => ({ ...field })) as unknown as BlockProperty[];
}
