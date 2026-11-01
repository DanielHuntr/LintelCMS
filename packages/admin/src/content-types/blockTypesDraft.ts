import type { BlockType, Field, FieldType } from "../fields/field.types.js";
import { t } from "../i18n/strings.js";
import { defaultOptionsFor, hasChoices, settingsProblem } from "./fieldSettingsDraft.js";
import { cleanTypedHandle, handleFromLabel, isValidHandle, uniqueHandle } from "./handle.js";

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
      options: defaultOptionsFor(type),
      draft: { key, handleFollows: true },
    },
  ];
}

export function changeInnerField(
  fields: readonly Field[],
  key: string,
  changes: Partial<Omit<Field, "handle" | "type" | "draft">>,
): Field[] {
  return fields.map((field) => {
    if (field.draft?.key !== key) return field;
    const updated = { ...field, ...changes };
    if (changes.label === undefined || !field.draft.handleFollows) return updated;
    const others = fields.filter((other) => other !== field).map((other) => other.handle);
    return { ...updated, handle: uniqueHandle(handleFromLabel(changes.label) || "field", others) };
  });
}

/** A handle typed by hand stops following the label; clearing it hands it back. */
export function renameInnerField(fields: readonly Field[], key: string, typed: string): Field[] {
  return fields.map((field) => {
    if (field.draft?.key !== key) return field;
    const handle = cleanTypedHandle(typed);
    return handle === ""
      ? {
          ...field,
          handle: handleFromLabel(field.label) || "field",
          draft: { key, handleFollows: true },
        }
      : { ...field, handle, draft: { key, handleFollows: false } };
  });
}

/** Changes an inner field's type, starting its options afresh. */
export function retypeInnerField(fields: readonly Field[], key: string, type: FieldType): Field[] {
  return fields.map((field) =>
    field.draft?.key === key ? { ...field, type, options: defaultOptionsFor(type) } : field,
  );
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
      if (hasChoices(field.type) && (field.options.choices ?? []).length === 0) {
        return t("builder.blocks.problem.choices", { name: blockType.name, label: field.label });
      }
      const problem = settingsProblem(field, blockType.fields);
      if (problem) return `${blockType.name}, ${field.label}: ${problem}`;
    }
  }
  return null;
}

/**
 * The block types as the API takes them: no bookkeeping, trimmed text, and each inner field
 * cleaned the way the builder cleans a top-level one (via `cleanField`, which it shares).
 */
export function blockTypesForSaving(
  blockTypes: readonly BlockType[],
  cleanField: (field: Field) => Field,
): BlockType[] {
  return blockTypes.map((blockType) => ({
    handle: blockType.handle,
    name: blockType.name.trim(),
    ...(blockType.description?.trim() ? { description: blockType.description.trim() } : {}),
    fields: blockType.fields.map(cleanField),
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
