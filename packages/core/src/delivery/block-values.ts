import type { BlocksOptions, BlockValue } from "../fieldtypes/blocks-fieldtype.js";
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
