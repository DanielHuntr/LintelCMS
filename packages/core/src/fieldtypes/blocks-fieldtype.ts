import { z } from "zod";
import { handleSchema } from "../http/handle.schema.js";
import type { FieldMessages } from "../http/http-errors.js";
import type { FieldDefinition } from "./field-definition.schema.js";
import { defineFieldtype } from "./fieldtype.js";

/**
 * A page builder field: an ordered list of blocks, each of a type the blueprint defines
 * (Hero, Text, Call to action...), and each with that type's own fields. Stored as
 *
 *   [{ "id": "b1f0...", "type": "hero", "data": { "heading": "Welcome" } }]
 *
 * `id` is made by the editor when a block is added and never changes, so a block keeps its
 * identity (and its error messages) when it is moved. Block fields can be of any type except
 * another blocks field: one level of blocks covers page building without nesting puzzles.
 */

const blockTypeSchema = z.object({
  handle: handleSchema("Each block type needs a handle"),
  name: z
    .string({ error: "Each block type needs a name" })
    .trim()
    .min(1, { error: "Each block type needs a name" })
    .max(100, { error: "Block type names can be at most 100 characters" }),
  description: z
    .string({ error: "A block type's description should be text" })
    .max(200, { error: "Block type descriptions can be at most 200 characters" })
    .default(""),
  // Each field is checked in full by checkInnerFields, which replaces these with the
  // checked definitions; until then only "is it an object" is known.
  fields: z
    .array(
      z.custom<FieldDefinition>((candidate) => typeof candidate === "object" && candidate !== null),
      { error: "A block type's fields should be a list" },
    )
    .default([]),
});

export type BlockType = z.output<typeof blockTypeSchema>;

const blocksOptionsSchema = z.object({
  blockTypes: z
    .array(blockTypeSchema, { error: "A blocks field needs a list of block types" })
    .min(1, { error: "A blocks field needs at least one block type" })
    .refine((types) => new Set(types.map((type) => type.handle)).size === types.length, {
      error: "Each block type needs a different handle",
    }),
  maxBlocks: z
    .number({ error: "The most blocks should be a number" })
    .int({ error: "The most blocks should be a whole number" })
    .positive({ error: "The most blocks should be more than 0" })
    .optional(),
});

export type BlocksOptions = z.output<typeof blocksOptionsSchema>;

const blockValueSchema = z.object({
  id: z.string().trim().min(1).max(100),
  type: z.string(),
  data: z.record(z.string(), z.unknown()).default({}),
});

export type BlockValue = z.output<typeof blockValueSchema>;

export const blocksFieldtype = defineFieldtype({
  type: "blocks",
  name: "Blocks",
  description: "A page builder: sections such as a hero, text or a call to action, in any order.",
  category: "structure",
  keywords: ["replicator", "sets", "builder", "flexible", "modules", "sections", "matrix"],
  canBeInside: false,
  optionsSchema: blocksOptionsSchema,

  buildValueSchema: ({ maxBlocks }, label) => {
    const list = z
      .array(blockValueSchema, { error: `${label} should be a list of blocks` })
      .refine((blocks) => new Set(blocks.map((block) => block.id)).size === blocks.length, {
        error: `Two blocks in ${label} have the same id`,
      });
    return maxBlocks === undefined
      ? list
      : list.refine((blocks) => blocks.length <= maxBlocks, {
          error: `${label} can have at most ${maxBlocks} blocks`,
        });
  },

  checkInnerFields: (options, checkFieldList) => {
    const blockTypes: BlockType[] = [];
    for (const blockType of options.blockTypes) {
      const checked = checkFieldList(blockType.fields, blockType.name);
      if ("problem" in checked) {
        return checked;
      }
      blockTypes.push({ ...blockType, fields: checked.fields });
    }
    return { options: { ...options, blockTypes } };
  },

  /**
   * Each block's values are checked against its type's fields. Blocks of a type that has
   * since been removed from the blueprint are dropped, the way values of a removed field are.
   */
  checkNestedValues: async (value, options, label, checkFieldValues) => {
    const blocks = value as BlockValue[];
    const kept: BlockValue[] = [];
    const messages: FieldMessages = {};
    const summaries: string[] = [];

    for (const [index, block] of blocks.entries()) {
      const blockType = options.blockTypes.find((type) => type.handle === block.type);
      if (!blockType) {
        continue;
      }
      const checked = await checkFieldValues(blockType.fields, block.data);
      const problems = Object.entries(checked.messages);
      for (const [handle, message] of problems) {
        messages[`${block.id}.${handle}`] = message;
      }
      if (problems[0]) {
        summaries.push(`${blockType.name} (block ${index + 1}): ${problems[0][1]}`);
      }
      kept.push({ id: block.id, type: block.type, data: checked.values });
    }

    const [firstSummary, ...otherSummaries] = summaries;
    if (firstSummary) {
      messages[""] =
        otherSummaries.length === 0
          ? firstSummary
          : `${firstSummary}, and ${otherSummaries.length} more in ${label}`;
    }
    return { value: kept, messages };
  },
});
