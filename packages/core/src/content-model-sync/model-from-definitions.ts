import type { z } from "zod";
import { checkBlueprintFields, checkFieldDefinitions } from "../blueprints/blueprint-fields.js";
import { createBlueprintRequestSchema } from "../blueprints/blueprints.schema.js";
import {
  createCollectionRequestSchema,
  defaultAllowedChildren,
} from "../collections/collections.schema.js";
import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
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
}

type Definition = z.output<typeof modelDefinitionSchema>;

export function modelFromDefinitions(loaded: readonly LoadedDefinition[]): ModelFromFiles {
  const problems: string[] = [];
  const units: ModelUnit[] = [];
  const sources = new Map<string, string>();

  for (const { source, definition } of loaded) {
    const parsed = modelDefinitionSchema.safeParse(definition);
    if (!parsed.success) {
      problems.push(...parsed.error.issues.map((issue) => describeIssue(source, issue)));
      continue;
    }
    const result = unitFromDefinition(parsed.data);
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
  }

  const model = modelFromUnits(units);
  problems.push(...findReferenceProblems(model, sources));
  if (problems.length > 0) {
    throw new ContentModelProblemsError(problems);
  }
  return { model, sources };
}

function describeIssue(source: string, issue: z.core.$ZodIssue): string {
  const path = issue.path.join(".");
  if (issue.code === "invalid_type" && issue.message.endsWith("received undefined")) {
    return `${source}: "${path}" is missing`;
  }
  return `${source}: ${issue.message}${path === "" ? "" : ` (at ${path})`}`;
}

type UnitResult = { unit: ModelUnit } | { problems: string[] };

function unitFromDefinition(definition: Definition): UnitResult {
  if (definition.kind === "contentType") {
    return contentTypeUnit(definition);
  }
  if (definition.kind === "globalSet") {
    const checked = createGlobalSetRequestSchema.safeParse({ ...definition, fields: [] });
    if (!checked.success) {
      return { problems: issueMessages(checked.error) };
    }
    const fields = checkFields(fieldsFromSpecs(definition.fields), checkFieldDefinitions);
    if ("problems" in fields) {
      return fields;
    }
    const { handle, name } = checked.data;
    return { unit: { kind: "globalSet", handle, name, fields: fields.fields } };
  }
  if (definition.kind === "taxonomy") {
    const checked = createTaxonomyRequestSchema.safeParse(definition);
    return checked.success
      ? { unit: { kind: "taxonomy", ...checked.data } }
      : { problems: issueMessages(checked.error) };
  }
  const checked = createNavigationRequestSchema.safeParse(definition);
  return checked.success
    ? { unit: { kind: "menu", ...checked.data } }
    : { problems: issueMessages(checked.error) };
}

function contentTypeUnit(definition: Extract<Definition, { kind: "contentType" }>): UnitResult {
  const rawFields = fieldsFromSpecs(definition.fields);
  const checked = createBlueprintRequestSchema.safeParse({ ...definition, fields: rawFields });
  if (!checked.success) {
    return { problems: issueMessages(checked.error) };
  }
  const fields = checkFields(rawFields, checkBlueprintFields);
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
      allowedAtRoot: collection.allowedAtRoot,
      allowedChildren: collection.allowedChildren,
      childrenAsCollection: collection.childrenAsCollection,
      listColumns: collection.listColumns,
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
      allowedAtRoot: parsed.data.allowedAtRoot ?? true,
      allowedChildren: parsed.data.allowedChildren ?? defaultAllowedChildren(handle, structure),
      childrenAsCollection: parsed.data.childrenAsCollection ?? false,
      listColumns: parsed.data.listColumns ?? [],
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

/** The fields as the admin sends them: `{ handle, label, type, required, helpText, options }`. */
export function fieldsFromSpecs(specs: Readonly<Record<string, FieldSpec>>): unknown[] {
  return Object.entries(specs).map(([handle, spec]) => fieldFromSpec(handle, spec));
}

function fieldFromSpec(handle: string, spec: FieldSpec): Record<string, unknown> {
  const { type, label, required, helpText, ...options } = spec;
  const field = {
    handle,
    label: label ?? labelFromHandle(handle),
    type,
    required: required ?? false,
    helpText: helpText ?? "",
  };
  if (spec.type !== "blocks") {
    return { ...field, options };
  }
  const blockTypes = Object.entries(spec.blockTypes).map(([blockHandle, blockType]) => ({
    handle: blockHandle,
    name: blockType.name ?? labelFromHandle(blockHandle),
    description: blockType.description ?? "",
    fields: fieldsFromSpecs(blockType.fields),
  }));
  return { ...field, options: { ...options, blockTypes } };
}

function checkFields(
  rawFields: unknown[],
  check: (fields: readonly unknown[]) => FieldDefinition[],
): { fields: FieldDefinition[] } | { problems: string[] } {
  try {
    return { fields: check(rawFields) };
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
    if (unit.kind !== "contentType" && unit.kind !== "globalSet") {
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

/** A list of fields and the fields inside its blocks fields' block types. */
export function everyField(fields: readonly FieldDefinition[]): FieldDefinition[] {
  return fields.flatMap((field) => {
    if (field.type !== "blocks") {
      return [field];
    }
    const blockTypes = (field.options.blockTypes ?? []) as { fields: FieldDefinition[] }[];
    return [field, ...blockTypes.flatMap((blockType) => blockType.fields)];
  });
}
