import {
  customBlockType,
  instanceBlockHandle,
  instanceValues,
  type PageNode,
} from "@lintel/builder-model";
import type { EntryData } from "../entries/entries.table.js";
import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";

/**
 * Finding and changing what pages hold of a block, wherever it is: instances in page
 * designs (`{ type: "customBlock", props: { block, values } }`, at any depth) and blocks in
 * blocks fields whose block type is the site's block (`{ id, type, data }`).
 */

/** What one use of a block holds: its values. */
export type ValuesChange = (values: Record<string, unknown>) => Record<string, unknown>;

/** Every instance of `handle` in page designs, changed by `change` (nothing else is copied). */
export function mapPageInstances(
  value: unknown,
  handle: string,
  change: (node: PageNode) => PageNode,
): unknown {
  if (Array.isArray(value)) {
    let changed = false;
    const mapped = value.map((item) => {
      const next = mapPageInstances(item, handle, change);
      if (next !== item) changed = true;
      return next;
    });
    return changed ? mapped : value;
  }
  if (typeof value !== "object" || value === null) return value;
  const record = value as Record<string, unknown>;
  if (
    record.type === customBlockType &&
    instanceBlockHandle(record as unknown as PageNode) === handle
  ) {
    return change(record as unknown as PageNode);
  }
  let changed = false;
  const mapped: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(record)) {
    const next = mapPageInstances(inner, handle, change);
    if (next !== inner) changed = true;
    mapped[key] = next;
  }
  return changed ? mapped : value;
}

/** The handles of blocks fields' block types that are this site block. */
function blockTypesShowing(
  fields: readonly FieldDefinition[],
  handle: string,
): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const field of fields) {
    if (field.type !== "blocks") continue;
    const types = (field.options.blockTypes ?? []) as { handle: string; block?: string }[];
    const matching = types.filter((type) => type.block === handle).map((type) => type.handle);
    if (matching.length > 0) found.set(field.handle, matching);
  }
  return found;
}

/** Every block of `handle` in an entry's blocks fields, with its data changed. */
export function mapBlocksFieldValues(
  data: EntryData,
  fields: readonly FieldDefinition[],
  handle: string,
  change: ValuesChange,
): EntryData {
  let result = data;
  for (const [fieldHandle, types] of blockTypesShowing(fields, handle)) {
    const list = data[fieldHandle];
    if (!Array.isArray(list)) continue;
    let changed = false;
    const mapped = list.map((item) => {
      if (typeof item !== "object" || item === null) return item;
      const block = item as { type?: unknown; data?: unknown };
      if (typeof block.type !== "string" || !types.includes(block.type)) return item;
      const values =
        typeof block.data === "object" && block.data !== null
          ? (block.data as Record<string, unknown>)
          : {};
      changed = true;
      return { ...block, data: change(values) };
    });
    if (changed) result = { ...result, [fieldHandle]: mapped };
  }
  return result;
}

/** Every use's values in an entry's data: instances on its pages and blocks in its fields. */
export function collectValues(
  data: EntryData | null,
  fields: readonly FieldDefinition[],
  handle: string,
): Record<string, unknown>[] {
  if (!data) return [];
  const found: Record<string, unknown>[] = [];
  mapPageInstances(data, handle, (node) => {
    found.push(instanceValues(node));
    return node;
  });
  mapBlocksFieldValues(data, fields, handle, (values) => {
    found.push(values);
    return values;
  });
  return found;
}

/** Values with renamed properties under their new handles. */
export function renameValues(renames: Readonly<Record<string, string>>): ValuesChange {
  return (values) => {
    const renamed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(values)) {
      const to = renames[key] ?? key;
      if (renamed[to] === undefined || to === key) renamed[to] = value;
    }
    return renamed;
  };
}

/** Whether a value counts as filled in, for warning before a property is removed. */
export function isFilledIn(value: unknown): boolean {
  if (value === undefined || value === null || value === "" || value === false) return false;
  return !Array.isArray(value) || value.length > 0;
}

/** An instance with its values changed. */
export function withValues(node: PageNode, change: ValuesChange): PageNode {
  return { ...node, props: { ...node.props, values: change(instanceValues(node)) } };
}
