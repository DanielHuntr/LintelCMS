import type { BlocksOptions, BlockValue } from "../fieldtypes/blocks-fieldtype.js";
import type { FieldsOptions, RepeaterRow } from "../fieldtypes/container-fieldtypes.js";
import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";

/** A blocks field's stored blocks with their block types, leaving out removed types. */
export function eachBlock(field: FieldDefinition, value: unknown) {
  const { blockTypes } = field.options as BlocksOptions;
  const blocks = Array.isArray(value) ? (value as BlockValue[]) : [];
  return blocks.flatMap((block) => {
    const blockType = blockTypes.find((type) => type.handle === block.type);
    return blockType ? [{ block, blockType }] : [];
  });
}

/** A repeater's stored rows. */
export function eachRow(value: unknown): RepeaterRow[] {
  return Array.isArray(value)
    ? (value as RepeaterRow[]).filter((row) => typeof row === "object" && row !== null)
    : [];
}

/**
 * Every set of values inside a field that holds fields (each block, each repeater row, a
 * group's or fieldset's values), with the fields that describe them, so code that walks
 * values (finding images, delivering) can go inside any of them the same way.
 */
export function innerValueSets(
  field: FieldDefinition,
  value: unknown,
): { fields: readonly FieldDefinition[]; data: Readonly<Record<string, unknown>> }[] {
  if (field.type === "blocks") {
    return eachBlock(field, value).map(({ block, blockType }) => ({
      fields: blockType.fields,
      data: block.data,
    }));
  }
  const { fields } = field.options as Partial<FieldsOptions>;
  if (field.type === "repeater" && fields) {
    return eachRow(value).map((row) => ({ fields, data: row.data ?? {} }));
  }
  if ((field.type === "group" || field.type === "fieldset") && fields && isRecord(value)) {
    return [{ fields, data: value }];
  }
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
