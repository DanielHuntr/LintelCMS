import type { BlockType, BlockValue, EntryData, FieldValue } from "../field.types.js";

/**
 * The rules of a blocks field's value, as plain functions over the list of blocks so tests
 * can call them. Every change returns a new list; nothing is changed in place.
 */

/** The stored blocks, safely: anything that isn't a block is left out. */
export function blocksValue(value: unknown): BlockValue[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (block): block is BlockValue =>
        typeof block === "object" &&
        block !== null &&
        typeof (block as BlockValue).id === "string" &&
        typeof (block as BlockValue).type === "string",
    )
    .map((block) => ({ ...block, data: isRecord(block.data) ? block.data : {} }));
}

/** A new block's id. The API keeps it, so a block's messages follow it when it moves. */
export function newBlockId(): string {
  return crypto.randomUUID();
}

export function addBlock(
  blocks: readonly BlockValue[],
  type: string,
  id: string,
  atIndex = blocks.length,
): BlockValue[] {
  return [...blocks.slice(0, atIndex), { id, type, data: {} }, ...blocks.slice(atIndex)];
}

export function removeBlock(blocks: readonly BlockValue[], id: string): BlockValue[] {
  return blocks.filter((block) => block.id !== id);
}

/** A copy with the same values, straight after the original. */
export function duplicateBlock(
  blocks: readonly BlockValue[],
  id: string,
  copyId: string,
): BlockValue[] {
  const index = blocks.findIndex((block) => block.id === id);
  const original = blocks[index];
  if (!original) return [...blocks];
  const copy: BlockValue = {
    id: copyId,
    type: original.type,
    data: structuredClone(original.data),
  };
  return [...blocks.slice(0, index + 1), copy, ...blocks.slice(index + 1)];
}

/** Moves a block to where another one is, as a drag does. */
export function moveBlockTo(
  blocks: readonly BlockValue[],
  id: string,
  targetId: string,
): BlockValue[] {
  const from = blocks.findIndex((block) => block.id === id);
  const to = blocks.findIndex((block) => block.id === targetId);
  const moving = blocks[from];
  if (!moving || to === -1 || from === to) return [...blocks];
  const reordered = blocks.filter((block) => block.id !== id);
  reordered.splice(to, 0, moving);
  return reordered;
}

/** One place up or down, for the keyboard buttons. */
export function moveBlockBy(
  blocks: readonly BlockValue[],
  id: string,
  direction: -1 | 1,
): BlockValue[] {
  const index = blocks.findIndex((block) => block.id === id);
  const target = blocks[index + direction];
  return target ? moveBlockTo(blocks, id, target.id) : [...blocks];
}

export function changeBlockField(
  blocks: readonly BlockValue[],
  id: string,
  handle: string,
  value: FieldValue,
): BlockValue[] {
  return blocks.map((block) =>
    block.id === id ? { ...block, data: { ...block.data, [handle]: value } } : block,
  );
}

/**
 * A few words from the block, so a collapsed block still says what it holds: the first
 * text field with something in it ("Fresh bread daily").
 */
export function blockSummary(block: BlockValue, blockType: BlockType | undefined): string {
  for (const field of blockType?.fields ?? []) {
    const value = block.data[field.handle];
    if ((field.type === "text" || field.type === "textarea") && typeof value === "string") {
      const words = value.trim();
      if (words !== "") return words;
    }
  }
  return "";
}

/**
 * The messages for the fields inside a blocks field. The API keys them
 * "<field handle>.<block id>.<inner handle>"; this keeps one field's and drops its handle.
 */
export function innerErrors(
  errors: Readonly<Record<string, string>>,
  fieldHandle: string,
): Record<string, string> {
  const prefix = `${fieldHandle}.`;
  return Object.fromEntries(
    Object.entries(errors)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, message]) => [key.slice(prefix.length), message]),
  );
}

/** The messages for one block's fields, keyed by inner field handle. */
export function blockErrors(
  errors: Readonly<Record<string, string>>,
  blockId: string,
): Record<string, string> {
  return innerErrors(errors, blockId);
}

function isRecord(value: unknown): value is EntryData {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
