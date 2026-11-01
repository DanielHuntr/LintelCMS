import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import { findFieldtype } from "../fieldtypes/fieldtypes.registry.js";

/**
 * Looking at stored values the way a content model change would touch them: whether a
 * field holds anything, and what is left once fields that went away (or changed type) are
 * taken out. Works on an entry's `data` or a global set's values alike.
 */

type Values = Readonly<Record<string, unknown>>;

interface StoredBlock {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

interface StoredBlockType {
  handle: string;
  fields: FieldDefinition[];
}

/** Where an inner field lives: a block type of a blocks field. */
export interface BlockLocation {
  fieldHandle: string;
  blockTypeHandle: string;
}

export function hasValue(fieldType: string, value: unknown): boolean {
  const fieldtype = findFieldtype(fieldType);
  return fieldtype ? !fieldtype.isEmpty(value) : value !== undefined && value !== null;
}

export function blocksIn(value: unknown): StoredBlock[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (block): block is StoredBlock =>
      typeof block === "object" && block !== null && "type" in block && "data" in block,
  );
}

/** Whether these values have something in the field (or in it inside blocks of one type). */
export function holdsFieldValue(
  values: Values | null,
  field: Pick<FieldDefinition, "handle" | "type">,
  within?: BlockLocation,
): boolean {
  if (values === null) {
    return false;
  }
  if (!within) {
    return hasValue(field.type, values[field.handle]);
  }
  return blocksIn(values[within.fieldHandle]).some(
    (block) =>
      block.type === within.blockTypeHandle && hasValue(field.type, block.data[field.handle]),
  );
}

export function holdsBlocksOfType(values: Values | null, location: BlockLocation): boolean {
  return (
    values !== null &&
    blocksIn(values[location.fieldHandle]).some((block) => block.type === location.blockTypeHandle)
  );
}

/**
 * The values without anything the new fields no longer have room for: values of removed
 * fields, values of fields whose type changed (they wouldn't fit the new type), blocks of
 * removed block types, and the same inside the blocks that stay.
 */
export function pruneValues(
  previousFields: readonly FieldDefinition[],
  nextFields: readonly FieldDefinition[],
  values: Values,
): Record<string, unknown> {
  const pruned: Record<string, unknown> = { ...values };
  for (const previous of previousFields) {
    const next = nextFields.find((field) => field.handle === previous.handle);
    if (!next || next.type !== previous.type) {
      delete pruned[previous.handle];
      continue;
    }
    if (
      next.type === "blocks" &&
      pruned[next.handle] !== undefined &&
      pruned[next.handle] !== null
    ) {
      pruned[next.handle] = pruneBlocks(previous, next, pruned[next.handle]);
    }
  }
  return pruned;
}

function pruneBlocks(previous: FieldDefinition, next: FieldDefinition, value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value;
  }
  const previousTypes = (previous.options.blockTypes ?? []) as StoredBlockType[];
  const nextTypes = (next.options.blockTypes ?? []) as StoredBlockType[];
  return blocksIn(value).flatMap((block) => {
    const nextType = nextTypes.find((blockType) => blockType.handle === block.type);
    if (!nextType) {
      return [];
    }
    const previousType = previousTypes.find((blockType) => blockType.handle === block.type);
    const data = previousType
      ? pruneValues(previousType.fields, nextType.fields, block.data)
      : block.data;
    return [{ ...block, data }];
  });
}

export function sameValues(first: unknown, second: unknown): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}
