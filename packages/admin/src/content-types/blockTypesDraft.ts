import type { BlockType, Field, FieldOptions, FieldType } from "../fields/field.types.js";
import { t } from "../i18n/strings.js";
import { handleFromLabel, isValidHandle, uniqueHandle } from "./handle.js";

/**
 * The block types of a blocks field, as the blueprint builder edits them. Each block type
 * and each field inside it carries `draft` bookkeeping: a key for React lists that survives
 * renaming, and whether its handle still follows its name or label. `blockTypesForSaving`
 * strips it again.
 */

/** Any fieldtype can go in a block, except another blocks field. */
export function canGoInBlock(type: FieldType): boolean {
  return type !== "blocks";
}

/** Block types from the API get bookkeeping, with handles that no longer follow their names. */
export function withDraftKeys(blockTypes: readonly BlockType[]): BlockType[] {
  return blockTypes.map((blockType) => ({
    ...blockType,
    draft: { key: `saved:${blockType.handle}`, handleFollows: false },
    fields: blockType.fields.map((field) => ({
      ...field,
      options: field.options ?? {},
      draft: { key: `saved:${field.handle}`, handleFollows: false },
    })),
  }));
}

export function addBlockType(blockTypes: readonly BlockType[], key: string): BlockType[] {
  return [
    ...blockTypes,
    { handle: "", name: "", description: "", fields: [], draft: { key, handleFollows: true } },
  ];
}

export function changeBlockType(
  blockTypes: readonly BlockType[],
  key: string,
  changes: Partial<Pick<BlockType, "name" | "description" | "handle">>,
): BlockType[] {
  return blockTypes.map((blockType) => {
    if (blockType.draft?.key !== key) return blockType;
    const updated = { ...blockType, ...changes };
    if (changes.handle !== undefined) {
      return { ...updated, draft: { key, handleFollows: changes.handle === "" } };
    }
    if (changes.name !== undefined && blockType.draft.handleFollows) {
      const others = blockTypes.filter((other) => other !== blockType).map((other) => other.handle);
      return { ...updated, handle: uniqueHandle(handleFromLabel(changes.name, "block"), others) };
    }
    return updated;
  });
}

export function moveBlockType(
  blockTypes: readonly BlockType[],
  key: string,
  direction: -1 | 1,
): BlockType[] {
  return moveByKey(blockTypes, key, direction, (blockType) => blockType.draft?.key);
}

export function removeBlockType(blockTypes: readonly BlockType[], key: string): BlockType[] {
  return blockTypes.filter((blockType) => blockType.draft?.key !== key);
}

/** Changes the fields of one block type. */
export function changeInnerFields(
  blockTypes: readonly BlockType[],
  key: string,
  change: (fields: Field[]) => Field[],
): BlockType[] {
  return blockTypes.map((blockType) =>
    blockType.draft?.key === key ? { ...blockType, fields: change(blockType.fields) } : blockType,
  );
}

export function addInnerField(
  fields: readonly Field[],
  key: string,
  type: FieldType,
  label: string,
): Field[] {
  const handle = uniqueHandle(
    handleFromLabel(label) || "field",
    fields.map((field) => field.handle),
  );
  return [
    ...fields,
    {
      handle,
      label,
      type,
      required: false,
      options: type === "select" ? { choices: [], multiple: false } : {},
      draft: { key, handleFollows: true },
    },
  ];
}

export function changeInnerField(
  fields: readonly Field[],
  key: string,
  changes: Partial<Pick<Field, "label" | "required" | "options">>,
): Field[] {
  return fields.map((field) => {
    if (field.draft?.key !== key) return field;
    const updated = { ...field, ...changes };
    if (changes.label === undefined || !field.draft.handleFollows) return updated;
    const others = fields.filter((other) => other !== field).map((other) => other.handle);
    return { ...updated, handle: uniqueHandle(handleFromLabel(changes.label) || "field", others) };
  });
}

export function moveInnerField(fields: readonly Field[], key: string, direction: -1 | 1): Field[] {
  return moveByKey(fields, key, direction, (field) => field.draft?.key);
}

export function removeInnerField(fields: readonly Field[], key: string): Field[] {
  return fields.filter((field) => field.draft?.key !== key);
}

/**
 * What the builder must fix before saving a blocks field, as one plain sentence, or null.
 * The API checks the same rules; checking here gives the message straight away.
 */
export function blockTypesProblem(blockTypes: readonly BlockType[]): string | null {
  if (blockTypes.length === 0) return t("builder.blocks.problem.none");
  const handles = new Set<string>();
  for (const blockType of blockTypes) {
    if (blockType.name.trim() === "") return t("builder.blocks.problem.name");
    if (!isValidHandle(blockType.handle) || handles.has(blockType.handle)) {
      return t("builder.blocks.problem.handle", { name: blockType.name });
    }
    handles.add(blockType.handle);
    const fieldHandles = new Set<string>();
    for (const field of blockType.fields) {
      if (field.label.trim() === "") {
        return t("builder.blocks.problem.fieldLabel", { name: blockType.name });
      }
      if (!isValidHandle(field.handle) || fieldHandles.has(field.handle)) {
        return t("builder.blocks.problem.fieldHandle", {
          name: blockType.name,
          label: field.label,
        });
      }
      fieldHandles.add(field.handle);
      if (field.type === "select" && (field.options.choices ?? []).length === 0) {
        return t("builder.blocks.problem.choices", { name: blockType.name, label: field.label });
      }
    }
  }
  return null;
}

/**
 * The block types as the API takes them: no bookkeeping, trimmed text, and only the options
 * that apply to each inner field's type (via `cleanOptions`, which the builder shares).
 */
export function blockTypesForSaving(
  blockTypes: readonly BlockType[],
  cleanOptions: (type: FieldType, options: FieldOptions) => FieldOptions,
): BlockType[] {
  return blockTypes.map((blockType) => ({
    handle: blockType.handle,
    name: blockType.name.trim(),
    ...(blockType.description?.trim() ? { description: blockType.description.trim() } : {}),
    fields: blockType.fields.map((field) => ({
      handle: field.handle,
      label: field.label.trim(),
      type: field.type,
      required: field.required,
      ...(field.helpText?.trim() ? { helpText: field.helpText.trim() } : {}),
      options: cleanOptions(field.type, field.options),
    })),
  }));
}

function moveByKey<Item>(
  items: readonly Item[],
  key: string,
  direction: -1 | 1,
  keyOf: (item: Item) => string | undefined,
): Item[] {
  const index = items.findIndex((item) => keyOf(item) === key);
  const target = index + direction;
  const moving = items[index];
  if (!moving || target < 0 || target >= items.length) return [...items];
  const reordered = items.filter((_, position) => position !== index);
  reordered.splice(target, 0, moving);
  return reordered;
}
