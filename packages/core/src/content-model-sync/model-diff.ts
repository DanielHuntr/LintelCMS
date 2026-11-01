import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import {
  type ContentModel,
  canonicalJson,
  type ContentTypeUnit,
  type FieldsetUnit,
  type GlobalSetUnit,
  type ModelCollection,
  type ModelUnit,
  sortedUnits,
  unitKey,
} from "./content-model.schema.js";
import type { BlockLocation } from "./stored-values.js";

/**
 * What it would take to turn one content model into another, as a list of changes small
 * enough to explain one by one ("add the field `subtitle`", "remove the taxonomy Tags").
 * Whether a change loses content is decided later, against the stored values
 * (model-impact.ts); this only says what changes.
 */

/** A content type or a global set: something that has fields. */
export type FieldOwner = ContentTypeUnit | GlobalSetUnit | FieldsetUnit;

/** An inner field's place, with the block type's name for messages. */
export interface InnerFieldLocation extends BlockLocation {
  blockTypeName: string;
}

export type ModelChange =
  | { action: "addUnit"; unit: ModelUnit }
  | { action: "removeUnit"; unit: ModelUnit }
  | { action: "renameUnit"; unit: ModelUnit; previousName: string }
  | { action: "changeMenuLevels"; unit: ModelUnit & { kind: "menu" }; previousLevels: number }
  | { action: "changeBlock"; unit: ModelUnit & { kind: "block" }; what: string[] }
  | { action: "addField"; owner: FieldOwner; field: FieldDefinition; within?: InnerFieldLocation }
  | {
      action: "removeField";
      owner: FieldOwner;
      field: FieldDefinition;
      within?: InnerFieldLocation;
    }
  | {
      action: "changeFieldType";
      owner: FieldOwner;
      field: FieldDefinition;
      previousType: string;
      within?: InnerFieldLocation;
    }
  | {
      action: "changeField";
      owner: FieldOwner;
      field: FieldDefinition;
      within?: InnerFieldLocation;
    }
  | { action: "reorderFields"; owner: FieldOwner }
  | { action: "addBlockType"; owner: FieldOwner; field: FieldDefinition; blockTypeName: string }
  | {
      action: "removeBlockType";
      owner: FieldOwner;
      field: FieldDefinition;
      location: InnerFieldLocation;
    }
  | { action: "addCollection"; owner: ContentTypeUnit; collection: ModelCollection }
  | { action: "removeCollection"; owner: ContentTypeUnit; collection: ModelCollection }
  | {
      action: "moveCollection";
      owner: ContentTypeUnit;
      previousOwner: ContentTypeUnit;
      collection: ModelCollection;
    }
  | {
      action: "changeCollection";
      owner: ContentTypeUnit;
      collection: ModelCollection;
      previous: ModelCollection;
    };

interface StoredBlockType {
  handle: string;
  name: string;
  fields: FieldDefinition[];
}

export function diffModels(current: ContentModel, target: ContentModel): ModelChange[] {
  const changes: ModelChange[] = [];
  const targetCollections = collectionOwners(target);
  const currentCollections = collectionOwners(current);

  for (const unit of sortedUnits(new Map([...current, ...target]))) {
    const key = unitKey(unit);
    const before = current.get(key);
    const after = target.get(key);
    if (!before && after) {
      changes.push({ action: "addUnit", unit: after });
      if (after.kind === "contentType") {
        changes.push(...collectionChanges(undefined, after, currentCollections));
      }
    } else if (before && !after) {
      if (before.kind === "contentType") {
        changes.push(...removedCollections(before, targetCollections));
      }
      changes.push({ action: "removeUnit", unit: before });
    } else if (before && after) {
      changes.push(...unitChanges(before, after, currentCollections, targetCollections));
    }
  }
  return changes;
}

function collectionOwners(model: ContentModel): Map<string, ContentTypeUnit> {
  const owners = new Map<string, ContentTypeUnit>();
  for (const unit of model.values()) {
    if (unit.kind === "contentType") {
      unit.collections.forEach((collection) => owners.set(collection.handle, unit));
    }
  }
  return owners;
}

function unitChanges(
  before: ModelUnit,
  after: ModelUnit,
  currentCollections: Map<string, ContentTypeUnit>,
  targetCollections: Map<string, ContentTypeUnit>,
): ModelChange[] {
  const changes: ModelChange[] = [];
  if (before.name !== after.name) {
    changes.push({ action: "renameUnit", unit: after, previousName: before.name });
  }
  if (before.kind === "menu" && after.kind === "menu" && before.maxDepth !== after.maxDepth) {
    changes.push({ action: "changeMenuLevels", unit: after, previousLevels: before.maxDepth });
  }
  if (before.kind === "block" && after.kind === "block") {
    const what = (["properties", "template", "icon", "category", "description"] as const).filter(
      (key) => canonicalJson(before[key]) !== canonicalJson(after[key]),
    );
    if (what.length > 0) changes.push({ action: "changeBlock", unit: after, what });
  }
  if (
    (before.kind === "contentType" || before.kind === "globalSet" || before.kind === "fieldset") &&
    (after.kind === "contentType" || after.kind === "globalSet" || after.kind === "fieldset")
  ) {
    changes.push(...fieldChanges(after, before.fields, after.fields));
  }
  if (before.kind === "contentType" && after.kind === "contentType") {
    changes.push(...collectionChanges(before, after, currentCollections));
    changes.push(
      ...removedCollections(before, targetCollections).filter(
        (change) =>
          !after.collections.some((collection) => collection.handle === change.collection.handle),
      ),
    );
  }
  return changes;
}

/** Collections added to `after` or changed in it; one taken from another content type is a move. */
function collectionChanges(
  before: ContentTypeUnit | undefined,
  after: ContentTypeUnit,
  currentCollections: Map<string, ContentTypeUnit>,
): ModelChange[] {
  const changes: ModelChange[] = [];
  for (const collection of after.collections) {
    const previous = before?.collections.find(
      (candidate) => candidate.handle === collection.handle,
    );
    const previousOwner = currentCollections.get(collection.handle);
    if (previous) {
      if (canonicalJson(previous) !== canonicalJson(collection)) {
        changes.push({ action: "changeCollection", owner: after, collection, previous });
      }
    } else if (previousOwner && previousOwner.handle !== after.handle) {
      changes.push({ action: "moveCollection", owner: after, previousOwner, collection });
    } else {
      changes.push({ action: "addCollection", owner: after, collection });
    }
  }
  return changes;
}

/** Collections of `before` that no content type has any more (moves are reported by the new owner). */
function removedCollections(
  before: ContentTypeUnit,
  targetCollections: Map<string, ContentTypeUnit>,
): Extract<ModelChange, { action: "removeCollection" }>[] {
  return before.collections
    .filter((collection) => !targetCollections.has(collection.handle))
    .map((collection) => ({ action: "removeCollection", owner: before, collection }));
}

function fieldChanges(
  owner: FieldOwner,
  before: readonly FieldDefinition[],
  after: readonly FieldDefinition[],
  within?: InnerFieldLocation,
): ModelChange[] {
  const changes: ModelChange[] = [];
  for (const field of before) {
    if (!after.some((candidate) => candidate.handle === field.handle)) {
      changes.push({ action: "removeField", owner, field, ...(within ? { within } : {}) });
    }
  }
  for (const field of after) {
    const previous = before.find((candidate) => candidate.handle === field.handle);
    if (!previous) {
      changes.push({ action: "addField", owner, field, ...(within ? { within } : {}) });
    } else if (previous.type !== field.type) {
      changes.push({
        action: "changeFieldType",
        owner,
        field,
        previousType: previous.type,
        ...(within ? { within } : {}),
      });
    } else if (field.type === "blocks") {
      changes.push(...blocksFieldChanges(owner, previous, field));
    } else if (canonicalJson(previous) !== canonicalJson(field)) {
      changes.push({ action: "changeField", owner, field, ...(within ? { within } : {}) });
    }
  }
  const order = (fields: readonly FieldDefinition[]) =>
    fields
      .map((field) => field.handle)
      .filter(
        (handle) =>
          before.some((field) => field.handle === handle) &&
          after.some((field) => field.handle === handle),
      );
  if (!within && order(before).join() !== order(after).join()) {
    changes.push({ action: "reorderFields", owner });
  }
  return changes;
}

function blocksFieldChanges(
  owner: FieldOwner,
  previous: FieldDefinition,
  field: FieldDefinition,
): ModelChange[] {
  const changes: ModelChange[] = [];
  const beforeTypes = (previous.options.blockTypes ?? []) as StoredBlockType[];
  const afterTypes = (field.options.blockTypes ?? []) as StoredBlockType[];
  for (const blockType of beforeTypes) {
    if (!afterTypes.some((candidate) => candidate.handle === blockType.handle)) {
      changes.push({
        action: "removeBlockType",
        owner,
        field,
        location: locationOf(field, blockType),
      });
    }
  }
  for (const blockType of afterTypes) {
    const earlier = beforeTypes.find((candidate) => candidate.handle === blockType.handle);
    if (!earlier) {
      changes.push({ action: "addBlockType", owner, field, blockTypeName: blockType.name });
      continue;
    }
    changes.push(
      ...fieldChanges(owner, earlier.fields, blockType.fields, locationOf(field, blockType)),
    );
  }
  const withoutBlockTypes = (definition: FieldDefinition) => ({
    ...definition,
    options: { ...definition.options, blockTypes: undefined },
  });
  const blockTypesSettings = (types: StoredBlockType[]) =>
    types.map(({ handle, name, ...rest }) => ({
      handle,
      name,
      description: (rest as { description?: string }).description,
    }));
  if (
    canonicalJson(withoutBlockTypes(previous)) !== canonicalJson(withoutBlockTypes(field)) ||
    canonicalJson(
      blockTypesSettings(beforeTypes).filter((type) =>
        afterTypes.some((other) => other.handle === type.handle),
      ),
    ) !==
      canonicalJson(
        blockTypesSettings(afterTypes).filter((type) =>
          beforeTypes.some((other) => other.handle === type.handle),
        ),
      )
  ) {
    changes.push({ action: "changeField", owner, field });
  }
  return changes;
}

function locationOf(field: FieldDefinition, blockType: StoredBlockType): InnerFieldLocation {
  return {
    fieldHandle: field.handle,
    blockTypeHandle: blockType.handle,
    blockTypeName: blockType.name,
  };
}

/** The units a change belongs to; a move belongs to both content types. */
export function unitKeysOf(change: ModelChange): string[] {
  if (change.action === "moveCollection") {
    return [unitKey(change.owner), unitKey(change.previousOwner)];
  }
  return [unitKey("unit" in change ? change.unit : change.owner)];
}
