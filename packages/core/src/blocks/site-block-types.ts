import type { DatabaseOrTransaction } from "../database/client.js";
import { InvalidFieldsError } from "../http/http-errors.js";
import { loadBlockLibrary } from "./blocks.service.js";

/**
 * The site's blocks in content types' blocks fields. A block type that names a block,
 * `{ "handle": "team_card", "block": "team_card" }`, gets the block's name, description and
 * properties as its fields, refreshed whenever the block is saved, the way Fieldset fields
 * keep a copy of their fieldset. Everything else (the editor, checking each block's values,
 * the delivery API, GraphQL's types) then treats it as an ordinary block type.
 */

interface RawBlockType {
  handle?: unknown;
  block?: unknown;
  [key: string]: unknown;
}

/** Whether any blocks field offers this block. */
export function usesSiteBlock(fields: readonly unknown[], handle: string): boolean {
  return fields.some((field) =>
    blockTypesOf(field).some((blockType) => blockType.block === handle),
  );
}

/** Fills in block types that name one of the site's blocks, before a blueprint is checked. */
export async function fillSiteBlockTypes(
  database: DatabaseOrTransaction,
  rawFields: readonly unknown[],
): Promise<unknown[]> {
  if (!rawFields.some((field) => blockTypesOf(field).some((type) => type.block !== undefined))) {
    return [...rawFields];
  }
  const library = new Map((await loadBlockLibrary(database)).map((block) => [block.handle, block]));
  const missing: Record<string, string> = {};
  const filled = rawFields.map((field) => {
    const blockTypes = blockTypesOf(field);
    if (!blockTypes.some((type) => type.block !== undefined)) return field;
    const record = field as { handle?: unknown; options: Record<string, unknown> };
    return {
      ...record,
      options: {
        ...record.options,
        blockTypes: blockTypes.map((blockType) => {
          if (blockType.block === undefined) return blockType;
          const block =
            typeof blockType.block === "string" ? library.get(blockType.block) : undefined;
          if (!block) {
            missing[String(record.handle ?? "blocks")] =
              `The site has no block called “${String(blockType.block)}”`;
            return blockType;
          }
          return {
            handle: block.handle,
            name: block.name,
            description: block.description,
            block: block.handle,
            fields: [...block.properties],
          };
        }),
      },
    };
  });
  if (Object.keys(missing).length > 0) throw new InvalidFieldsError(missing);
  return filled;
}

function blockTypesOf(field: unknown): RawBlockType[] {
  if (typeof field !== "object" || field === null) return [];
  const { type, options } = field as { type?: unknown; options?: unknown };
  if (type !== "blocks" || typeof options !== "object" || options === null) return [];
  const blockTypes = (options as { blockTypes?: unknown }).blockTypes;
  return Array.isArray(blockTypes)
    ? blockTypes.filter(
        (blockType): blockType is RawBlockType =>
          typeof blockType === "object" && blockType !== null,
      )
    : [];
}
