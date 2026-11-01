import type { BlockComponent } from "@lintel/builder/render";
import type { z } from "zod";
import type { BlockDefinition } from "../blocks/block-definition.js";
import { blockFromDefinition } from "../blocks/define-block.js";
import { checkBlueprintFields, checkFieldDefinitions } from "../blueprints/blueprint-fields.js";
import { createBlueprintRequestSchema } from "../blueprints/blueprints.schema.js";
import { createCollectionRequestSchema } from "../collections/collections.schema.js";
import {
  type FieldsetFields,
  nestedFieldsetProblem,
  withFieldsetFields,
} from "../fieldsets/fieldset-imports.js";
import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import { fieldSettingsShape } from "../fieldtypes/field-settings.schema.js";
import { createFieldsetRequestSchema } from "../fieldsets/fieldsets.schema.js";
import { createGlobalSetRequestSchema } from "../globals/globals.schema.js";
import { InvalidFieldsError } from "../http/http-errors.js";
import { createNavigationRequestSchema } from "../navigation/navigation.schema.js";
import { createTaxonomyRequestSchema } from "../taxonomies/taxonomies.schema.js";
import {
  type ContentModel,
  type ModelCollection,
  type ModelUnit,
  modelFromUnits,
  unitKey,
} from "./content-model.schema.js";
import { ContentModelProblemsError } from "./content-model-sync.errors.js";
import { type FieldSpec, labelFromHandle } from "./field-helpers.js";
import { modelDefinitionSchema } from "./model-definition.schema.js";

/**
 * Turns what content model files define into the comparable model (content-model.schema.ts),
 * checking each definition with the same rules the admin uses, so a file can't make
 * anything the blueprint builder would refuse. Every problem in every file is reported at
 * once, each starting with the file it is in.
 */

export interface LoadedDefinition {
  /** Where the definition came from, as people should see it: `content-types/post.ts`. */
  source: string;
  definition: unknown;
}

export interface ModelFromFiles {
  model: ContentModel;
  /** The file each unit came from, by unit key. */
  sources: ReadonlyMap<string, string>;
  /** Blocks drawn by React components, by handle: they live only in their files. */
  blockComponents: ReadonlyMap<string, BlockComponent>;
}

/** The site's blocks files define, for blocks fields' block types that name one. */
type BlockProperties = Map<
  string,
  { name: string; description: string; properties: FieldDefinition[] }
>;

type Definition = z.output<typeof modelDefinitionSchema>;

export function modelFromDefinitions(loaded: readonly LoadedDefinition[]): ModelFromFiles {
  const problems: string[] = [];
  const units: ModelUnit[] = [];
  const sources = new Map<string, string>();
  const parsedDefinitions: { source: string; definition: Definition }[] = [];

  for (const { source, definition } of loaded) {
    const parsed = modelDefinitionSchema.safeParse(definition);
    if (!parsed.success) {
      problems.push(...parsed.error.issues.map((issue) => describeIssue(source, issue)));
      continue;
    }
    parsedDefinitions.push({ source, definition: parsed.data });
  }

  // Fieldsets and blocks first: content types and global sets copy their fields.
  const fieldsets = new Map<string, FieldDefinition[]>();
  const blocks: BlockProperties = new Map();
  const blockComponents = new Map<string, BlockComponent>();
  const comesFirst = (kind: string) => kind === "fieldset" || kind === "block";
  const ordered = [
    ...parsedDefinitions.filter(({ definition }) => comesFirst(definition.kind)),
    ...parsedDefinitions.filter(({ definition }) => !comesFirst(definition.kind)),
  ];
  for (const { source, definition } of ordered) {
    const result =
      definition.kind === "block"
        ? blockUnit(definition, source, blockComponents)
        : unitFromDefinition(definition, fieldsets, blocks);
    if ("problems" in result) {
      problems.push(...result.problems.map((problem) => `${source}: ${problem}`));
      continue;
    }
    const key = unitKey(result.unit);
    const earlier = sources.get(key);
    if (earlier) {
      problems.push(
        `${source}: ${earlier} already defines the ${result.unit.kind} "${result.unit.handle}"`,
      );
      continue;
    }
    sources.set(key, source);
    units.push(result.unit);
    if (result.unit.kind === "fieldset") {
      fieldsets.set(result.unit.handle, result.unit.fields);
    }
    if (result.unit.kind === "block") {
      const { handle, name, description, properties } = result.unit;
      blocks.set(handle, { name, description, properties });
    }
  }

  const model = modelFromUnits(units);
  problems.push(...findReferenceProblems(model, sources));
  if (problems.length > 0) {
    throw new ContentModelProblemsError(problems);
  }
  return { model, sources, blockComponents };
}

/**
 * A block file: `team_card.block.ts` is the block `team_card` unless it says otherwise,
 * checked with the same rules as blocks from plugins (see src/blocks/define-block.ts).
 */
function blockUnit(
  definition: Extract<Definition, { kind: "block" }>,
  source: string,
  components: Map<string, BlockComponent>,
): UnitResult {
  const fileName = source.split("/").at(-1) ?? source;
  const handle = definition.handle ?? fileName.replace(/(\.block)?\.(tsx?|mts|ya?ml)$/, "");
  try {
    // The schema has checked its shape; its properties' types are the field helpers'.
    const block = blockFromDefinition(definition as unknown as BlockDefinition, handle, "code");
    if (typeof definition.render === "function") {
      components.set(handle, definition.render as BlockComponent);
    }
    return {
      unit: {
        kind: "block",
        handle: block.handle,
        name: block.name,
        icon: block.icon,
        category: block.category,
        description: block.description,
        properties: block.properties as FieldDefinition[],
        template: block.template,
      },
    };
  } catch (error) {
    if (error instanceof InvalidFieldsError) {
      return {
        problems: Object.entries(error.fields).map(([key, message]) =>
          key === "render" || key === "handle" || key === "name"
            ? message
            : `property "${key}": ${message}`,
        ),
      };
    }
    throw error;
  }
}

/**
 * Blocks fields' block types that name one of the site's blocks get its name, description
 * and properties, as the admin stores them (see src/blocks/site-block-types.ts).
 */
function withBlockTypes(
  rawFields: unknown[],
  blocks: BlockProperties,
): { fields: unknown[]; problems: string[] } {
  const problems: string[] = [];
  const fields = rawFields.map((field) => {
    const record = field as {
      handle?: string;
      type?: string;
      options?: { blockTypes?: unknown[] };
    };
    if (record.type !== "blocks" || !Array.isArray(record.options?.blockTypes)) return field;
    const blockTypes = record.options.blockTypes.map((candidate) => {
      const blockType = candidate as { handle: string; block?: string };
      if (blockType.block === undefined) return blockType;
      const block = blocks.get(blockType.block);
      if (!block) {
        problems.push(
          `field "${record.handle ?? ""}": the block type ${blockType.handle} uses the block "${blockType.block}", but no file in blocks/ defines it`,
        );
        return blockType;
      }
      return {
        handle: blockType.block,
        name: block.name,
        description: block.description,
        block: blockType.block,
        fields: block.properties,
      };
    });
    return { ...record, options: { ...record.options, blockTypes } };
  });
  return { fields, problems };
}

function describeIssue(source: string, issue: z.core.$ZodIssue): string {
  const path = issue.path.join(".");
  if (issue.code === "invalid_type" && issue.message.endsWith("received undefined")) {
    return `${source}: "${path}" is missing`;
  }
  return `${source}: ${issue.message}${path === "" ? "" : ` (at ${path})`}`;
}

type UnitResult = { unit: ModelUnit } | { problems: string[] };

function unitFromDefinition(
  definition: Exclude<Definition, { kind: "block" }>,
  fieldsets: FieldsetFields,
  blocks: BlockProperties,
): UnitResult {
  if (definition.kind === "contentType") {
    return contentTypeUnit(definition, fieldsets, blocks);
  }
  if (definition.kind === "fieldset") {
    const checked = createFieldsetRequestSchema.safeParse({ ...definition, fields: [] });
    if (!checked.success) {
      return { problems: issueMessages(checked.error) };
    }
    const rawFields = fieldsFromSpecs(definition.fields);
    const nested = nestedFieldsetProblem(rawFields);
    if (nested) {
      return { problems: [nested] };
    }
    const fields = checkFields(rawFields, checkFieldDefinitions);
    if ("problems" in fields) {
      return fields;
    }
    const { handle, name } = checked.data;
    return { unit: { kind: "fieldset", handle, name, fields: fields.fields } };
  }
  if (definition.kind === "globalSet") {
    const checked = createGlobalSetRequestSchema.safeParse({ ...definition, fields: [] });
    if (!checked.success) {
      return { problems: issueMessages(checked.error) };
    }
    const fields = checkFields(
      fieldsFromSpecs(definition.fields),
      checkFieldDefinitions,
      fieldsets,
    );
    if ("problems" in fields) {
      return fields;
    }
    const { handle, name } = checked.data;
    return { unit: { kind: "globalSet", handle, name, fields: fields.fields } };
  }
  if (definition.kind === "taxonomy") {
    const checked = createTaxonomyRequestSchema.safeParse(definition);
    return checked.success
      ? // Which site owns a taxonomy is chosen in the admin, not in content model files.
        { unit: { kind: "taxonomy", handle: checked.data.handle, name: checked.data.name } }
      : { problems: issueMessages(checked.error) };
  }
  const checked = createNavigationRequestSchema.safeParse(definition);
  return checked.success
    ? { unit: { kind: "menu", ...checked.data } }
    : { problems: issueMessages(checked.error) };
}

function contentTypeUnit(
  definition: Extract<Definition, { kind: "contentType" }>,
  fieldsets: FieldsetFields,
  blocks: BlockProperties,
): UnitResult {
  const withBlocks = withBlockTypes(fieldsFromSpecs(definition.fields), blocks);
  if (withBlocks.problems.length > 0) {
    return { problems: withBlocks.problems };
  }
  const rawFields = withBlocks.fields;
  const checked = createBlueprintRequestSchema.safeParse({ ...definition, fields: rawFields });
  if (!checked.success) {
    return { problems: issueMessages(checked.error) };
  }
  const fields = checkFields(rawFields, checkBlueprintFields, fieldsets);
  if ("problems" in fields) {
    return fields;
  }

  const problems: string[] = [];
  const collections: ModelCollection[] = [];
  for (const collection of listCollections(definition.collection)) {
    const parsed = createCollectionRequestSchema.safeParse({
      handle: collection.handle,
      name: collection.name,
      blueprintHandle: checked.data.handle,
      structure: collection.structure,
      routePattern: collection.route,
    });
    if (!parsed.success) {
      problems.push(...issueMessages(parsed.error).map((message) => `collection: ${message}`));
      continue;
    }
    const { handle, name, structure, routePattern } = parsed.data;
    collections.push({
      handle,
      name,
      structure,
      routePattern: routePattern === undefined ? defaultRoutePattern(handle) : routePattern,
    });
  }
  if (problems.length > 0) {
    return { problems };
  }
  const { handle, name } = checked.data;
  return { unit: { kind: "contentType", handle, name, fields: fields.fields, collections } };
}

/** Where a collection's entries live when no route is given; the same as the admin's default. */
export function defaultRoutePattern(collectionHandle: string): string {
  return `/${collectionHandle}/{slug}`;
}

function listCollections<Collection>(collection: Collection | Collection[] | undefined) {
  if (collection === undefined) {
    return [];
  }
  return Array.isArray(collection) ? collection : [collection];
}

/** The settings every field has, which sit beside `options` rather than in them. */
const SETTING_KEYS = new Set(Object.keys(fieldSettingsShape));

/** The fields as the admin sends them: `{ handle, label, type, required, helpText, options }`. */
export function fieldsFromSpecs(specs: Readonly<Record<string, unknown>>): unknown[] {
  // The file's shape has been checked by model-definition.schema.ts already.
  return Object.entries(specs).map(([handle, spec]) => fieldFromSpec(handle, spec as FieldSpec));
}

function fieldFromSpec(handle: string, spec: FieldSpec): Record<string, unknown> {
  const { type, label, required, helpText, ...rest } = spec;
  const settings: Record<string, unknown> = {};
  const options: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    (SETTING_KEYS.has(key) ? settings : options)[key] = value;
  }
  const field = {
    handle,
    label: label ?? labelFromHandle(handle),
    type,
    required: required ?? false,
    helpText: helpText ?? "",
    ...settings,
  };
  if (spec.type === "group" || spec.type === "repeater") {
    return { ...field, options: { ...options, fields: fieldsFromSpecs(spec.fields) } };
  }
  if (spec.type !== "blocks") {
    return { ...field, options };
  }
  const blockTypes = Object.entries(spec.blockTypes).map(([blockHandle, blockType]) => ({
    handle: blockHandle,
    name: blockType.name ?? labelFromHandle(blockHandle),
    description: blockType.description ?? "",
    ...(blockType.block === undefined ? {} : { block: blockType.block }),
    fields: fieldsFromSpecs(blockType.fields ?? {}),
  }));
  return { ...field, options: { ...options, blockTypes } };
}

/**
 * Checks fields with the admin's rules, after filling in the fields of any fieldsets they
 * use (a fieldset no file defines is a problem with that field).
 */
function checkFields(
  rawFields: unknown[],
  check: (fields: readonly unknown[]) => FieldDefinition[],
  fieldsets: FieldsetFields = new Map(),
): { fields: FieldDefinition[] } | { problems: string[] } {
  const filled = withFieldsetFields(rawFields, fieldsets);
  const missing = Object.entries(filled.missing);
  if (missing.length > 0) {
    return { problems: missing.map(([handle, message]) => `field "${handle}": ${message}`) };
  }
  try {
    return { fields: check(filled.fields) };
  } catch (error) {
    if (error instanceof InvalidFieldsError) {
      return {
        problems: Object.entries(error.fields).map(
          ([handle, message]) => `field "${handle}": ${message}`,
        ),
      };
    }
    throw error;
  }
}

function issueMessages(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const where = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return `${where}${issue.message}`;
  });
}

/**
 * Problems between files: a terms field choosing from a taxonomy no file defines, an
 * entries field naming a collection that isn't there, or two content types claiming the
 * same collection.
 */
function findReferenceProblems(
  model: ContentModel,
  sources: ReadonlyMap<string, string>,
): string[] {
  const problems: string[] = [];
  const collectionOwners = new Map<string, string>();
  for (const unit of model.values()) {
    if (unit.kind !== "contentType") {
      continue;
    }
    for (const collection of unit.collections) {
      const owner = collectionOwners.get(collection.handle);
      if (owner) {
        problems.push(
          `${sources.get(unitKey(unit))}: the collection "${collection.handle}" is also defined by ${owner}`,
        );
      }
      collectionOwners.set(collection.handle, sources.get(unitKey(unit)) ?? unit.handle);
    }
  }

  for (const unit of model.values()) {
    if (unit.kind !== "contentType" && unit.kind !== "globalSet" && unit.kind !== "fieldset") {
      continue;
    }
    for (const field of everyField(unit.fields)) {
      const source = sources.get(unitKey(unit));
      if (field.type === "terms") {
        const taxonomy = String(field.options.taxonomy);
        if (!model.has(unitKey({ kind: "taxonomy", handle: taxonomy }))) {
          problems.push(
            `${source}: field "${field.handle}" chooses terms from "${taxonomy}", but no file defines that taxonomy`,
          );
        }
      }
      if (field.type === "entries") {
        const collections = (field.options.collections ?? []) as string[];
        for (const collection of collections.filter((handle) => !collectionOwners.has(handle))) {
          problems.push(
            `${source}: field "${field.handle}" links to the collection "${collection}", but no file defines it`,
          );
        }
      }
    }
  }
  return problems;
}

/** A list of fields and every field inside them: in block types, groups and repeaters. */
export function everyField(fields: readonly FieldDefinition[]): FieldDefinition[] {
  return fields.flatMap((field) => {
    const inner = (field.options.fields ?? []) as FieldDefinition[];
    const blockTypes = (field.options.blockTypes ?? []) as { fields: FieldDefinition[] }[];
    return [
      field,
      ...everyField(inner),
      ...everyField(blockTypes.flatMap((blockType) => blockType.fields)),
    ];
  });
}
