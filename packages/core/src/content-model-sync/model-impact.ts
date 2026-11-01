import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { findFieldtype } from "../fieldtypes/fieldtypes.registry.js";
import { describeUnitKind } from "./content-model.schema.js";
import {
  countEntriesWithParents,
  countTermsInTaxonomy,
  listCollectionModelRows,
  listEntryValues,
  listGlobalSetModelRows,
  listGlobalValueRows,
  listMenuModelRows,
  listTaxonomyModelRows,
  type StoredEntryValues,
} from "./content-model-sync.repository.js";
import { type FieldOwner, type ModelChange, unitKeysOf } from "./model-diff.js";
import { holdsBlocksOfType, holdsFieldValue } from "./stored-values.js";

/**
 * Each change in plain English, with what it would do to content that's already written:
 * "Removing `excerpt` from Blog post would delete text from 14 entries in Blog posts."
 * A change is destructive only when something is actually there to lose, so removing a
 * field nobody has filled in yet goes ahead like any other change.
 */

export interface AssessedChange {
  /** The units the change belongs to (see `unitKey`). */
  unitKeys: string[];
  /** What changes, such as "Add the field `subtitle` to Blog post". */
  summary: string;
  /** What would be lost, when something would be. */
  impact: string | null;
  destructive: boolean;
}

export async function assessChanges(
  database: DatabaseOrTransaction,
  changes: readonly ModelChange[],
): Promise<AssessedChange[]> {
  const context = new ImpactContext(database);
  const assessed: AssessedChange[] = [];
  for (const change of changes) {
    const impact = await describeImpact(change, context);
    assessed.push({
      unitKeys: unitKeysOf(change),
      summary: summarise(change),
      impact,
      destructive: impact !== null,
    });
  }
  return assessed;
}

export function summarise(change: ModelChange): string {
  switch (change.action) {
    case "addUnit":
      return `Add the ${describeUnitKind(change.unit.kind)} ${change.unit.name}`;
    case "removeUnit":
      return `Remove the ${describeUnitKind(change.unit.kind)} ${change.unit.name}`;
    case "renameUnit":
      return `Rename the ${describeUnitKind(change.unit.kind)} ${change.previousName} to ${change.unit.name}`;
    case "changeMenuLevels":
      return `Let ${change.unit.name} have ${levels(change.unit.maxDepth)} instead of ${levels(change.previousLevels)}`;
    case "addField":
      return `Add the field \`${change.field.handle}\` to ${place(change.owner, change.within)}`;
    case "removeField":
      return `Remove the field \`${change.field.handle}\` from ${place(change.owner, change.within)}`;
    case "changeFieldType":
      return (
        `Change \`${change.field.handle}\` in ${place(change.owner, change.within)} from ` +
        `${fieldtypeName(change.previousType)} to ${fieldtypeName(change.field.type)}`
      );
    case "changeField":
      return `Change the settings of \`${change.field.handle}\` in ${place(change.owner, change.within)}`;
    case "reorderFields":
      return `Reorder the fields of ${change.owner.name}`;
    case "addBlockType":
      return `Add the block type ${change.blockTypeName} to \`${change.field.handle}\` in ${change.owner.name}`;
    case "removeBlockType":
      return `Remove the block type ${change.location.blockTypeName} from \`${change.field.handle}\` in ${change.owner.name}`;
    case "addCollection":
      return `Add the collection ${change.collection.name}, using ${change.owner.name}`;
    case "removeCollection":
      return `Remove the collection ${change.collection.name}`;
    case "moveCollection":
      return `Make ${change.collection.name} use ${change.owner.name} instead of ${change.previousOwner.name}`;
    case "changeCollection":
      return `Change the settings of the collection ${change.collection.name}`;
  }
}

function place(owner: FieldOwner, within: { blockTypeName: string } | undefined): string {
  return within ? `${within.blockTypeName} blocks in ${owner.name}` : owner.name;
}

function levels(count: number): string {
  return count === 1 ? "1 level" : `${count} levels`;
}

function fieldtypeName(type: string): string {
  return findFieldtype(type)?.name ?? type;
}

async function describeImpact(change: ModelChange, context: ImpactContext): Promise<string | null> {
  switch (change.action) {
    case "removeField":
    case "changeFieldType": {
      const count = await context.countValues(change.owner, (values) =>
        holdsFieldValue(
          values,
          change.action === "removeField"
            ? change.field
            : { ...change.field, type: change.previousType },
          change.within,
        ),
      );
      if (count.total === 0) {
        return null;
      }
      const what = valueWords(
        change.action === "removeField" ? change.field.type : change.previousType,
      );
      const verb =
        change.action === "removeField"
          ? `Removing \`${change.field.handle}\` would delete`
          : `Changing \`${change.field.handle}\` to ${fieldtypeName(change.field.type)} would clear`;
      return `${verb} ${what} from ${count.description}.`;
    }
    case "removeBlockType": {
      const count = await context.countValues(change.owner, (values) =>
        holdsBlocksOfType(values, change.location),
      );
      return count.total === 0
        ? null
        : `Removing the block type ${change.location.blockTypeName} would delete its blocks from ${count.description}.`;
    }
    case "removeCollection": {
      const count = await context.countCollectionEntries([change.collection.handle]);
      return count.total === 0
        ? null
        : `Removing ${change.collection.name} would delete ${count.description}.`;
    }
    case "changeCollection": {
      if (change.previous.structure !== "tree" || change.collection.structure === "tree") {
        return null;
      }
      const withParents = await context.countEntriesWithParents(change.collection.handle);
      return withParents === 0
        ? null
        : `Changing ${change.collection.name} from pages with parents to ${change.collection.structure === "dated" ? "posts by date" : "a simple list"} would take ${entries(withParents)} out from under their parent pages.`;
    }
    case "removeUnit":
      return context.describeUnitRemoval(change.unit);
    default:
      return null;
  }
}

function entries(count: number): string {
  return count === 1 ? "1 entry" : `${count} entries`;
}

/** What a field of this type holds, in words: "text", "images", "dates". */
function valueWords(type: string): string {
  const words: Record<string, string> = {
    text: "text",
    textarea: "text",
    richText: "text",
    markdown: "text",
    number: "numbers",
    toggle: "on/off settings",
    select: "choices",
    date: "dates",
    image: "images",
    link: "links",
    email: "email addresses",
    url: "web addresses",
    colour: "colours",
    list: "lists",
    entries: "links to other entries",
    terms: "chosen terms",
    blocks: "page sections",
    form: "chosen forms",
  };
  return words[type] ?? "values";
}

interface Count {
  total: number;
  /** "14 entries in Blog posts", or "the saved values of Site settings". */
  description: string;
}

/** Loads stored values once per owner, however many changes look at them. */
class ImpactContext {
  private collections?: Awaited<ReturnType<typeof listCollectionModelRows>>;
  private readonly entryValues = new Map<string, StoredEntryValues[]>();

  constructor(private readonly database: DatabaseOrTransaction) {}

  async countValues(
    owner: FieldOwner,
    holds: (values: Readonly<Record<string, unknown>> | null) => boolean,
  ): Promise<Count> {
    if (owner.kind === "globalSet") {
      const rows = await this.globalValues(owner.handle);
      const total = rows.filter((row) => holds(row.data)).length;
      return { total, description: `the saved values of ${owner.name}` };
    }
    const collections = (await this.collectionRows()).filter((row) =>
      owner.collections.some((collection) => collection.handle === row.handle),
    );
    const counts = await Promise.all(
      collections.map(async (collection) => {
        const values = await this.entriesOf(collection.id);
        return {
          name: collection.name,
          count: values.filter((entry) => holds(entry.data) || holds(entry.publishedData)).length,
        };
      }),
    );
    return describeEntryCounts(counts);
  }

  async countCollectionEntries(handles: readonly string[]): Promise<Count> {
    const collections = (await this.collectionRows()).filter((row) => handles.includes(row.handle));
    const counts = await Promise.all(
      collections.map(async (collection) => ({
        name: collection.name,
        count: (await this.entriesOf(collection.id)).length,
      })),
    );
    return describeEntryCounts(counts);
  }

  async countEntriesWithParents(handle: string): Promise<number> {
    const collection = (await this.collectionRows()).find((row) => row.handle === handle);
    return collection ? countEntriesWithParents(this.database, collection.id) : 0;
  }

  async describeUnitRemoval(
    unit: Extract<ModelChange, { action: "removeUnit" }>["unit"],
  ): Promise<string | null> {
    const kind = describeUnitKind(unit.kind);
    if (unit.kind === "contentType") {
      // Its collections are removed as changes of their own, which say what that deletes.
      return null;
    }
    if (unit.kind === "taxonomy") {
      const taxonomy = (await listTaxonomyModelRows(this.database, DEFAULT_TENANT_ID)).find(
        (row) => row.handle === unit.handle,
      );
      const terms = taxonomy ? await countTermsInTaxonomy(this.database, taxonomy.id) : 0;
      return terms === 0
        ? null
        : `Removing the ${kind} ${unit.name} would delete its ${terms === 1 ? "1 term" : `${terms} terms`}, and take them off every entry that uses them.`;
    }
    if (unit.kind === "globalSet") {
      const rows = await this.globalValues(unit.handle);
      const filled = rows.some((row) => Object.values(row.data).some((value) => value !== null));
      return filled
        ? `Removing the ${kind} ${unit.name} would delete everything saved in it.`
        : null;
    }
    const menu = (await listMenuModelRows(this.database, DEFAULT_TENANT_ID)).find(
      (row) => row.handle === unit.handle,
    );
    const items = menu?.items.length ?? 0;
    return items === 0
      ? null
      : `Removing the ${kind} ${unit.name} would delete its ${items === 1 ? "1 item" : `${items} items`}.`;
  }

  private async collectionRows() {
    this.collections ??= await listCollectionModelRows(this.database, DEFAULT_TENANT_ID);
    return this.collections;
  }

  private async entriesOf(collectionId: string): Promise<StoredEntryValues[]> {
    let values = this.entryValues.get(collectionId);
    if (!values) {
      values = await listEntryValues(this.database, [collectionId]);
      this.entryValues.set(collectionId, values);
    }
    return values;
  }

  private async globalValues(handle: string) {
    const globalSet = (await listGlobalSetModelRows(this.database, DEFAULT_TENANT_ID)).find(
      (row) => row.handle === handle,
    );
    return globalSet ? listGlobalValueRows(this.database, globalSet.id) : [];
  }
}

function describeEntryCounts(counts: readonly { name: string; count: number }[]): Count {
  const used = counts.filter((count) => count.count > 0);
  const total = used.reduce((sum, count) => sum + count.count, 0);
  const names = used.map((count) => count.name);
  const where =
    names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return { total, description: `${entries(total)} in ${where}` };
}
