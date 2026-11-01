import {
  createBlueprint,
  deleteBlueprint,
  updateBlueprint,
} from "../blueprints/blueprints.service.js";
import {
  createCollection,
  deleteCollection,
  updateCollection,
} from "../collections/collections.service.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { deleteEntry } from "../entries/entries.service.js";
import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import { replaceGlobalValuesData } from "../globals/global-values.repository.js";
import { createGlobalSet, deleteGlobalSet, updateGlobalSet } from "../globals/globals.service.js";
import {
  createNavigation,
  deleteNavigation,
  updateNavigation,
} from "../navigation/navigation.service.js";
import {
  createTaxonomy,
  deleteTaxonomy,
  updateTaxonomy,
} from "../taxonomies/taxonomies.service.js";
import {
  canonicalJson,
  type ContentModel,
  type ContentTypeUnit,
  type ModelCollection,
  type ModelUnit,
  sortedUnits,
  unitKey,
} from "./content-model.schema.js";
import {
  listCollectionModelRows,
  listEntryIdsInCollection,
  listEntryValues,
  listGlobalSetModelRows,
  listGlobalValueRows,
  replaceEntryValues,
} from "./content-model-sync.repository.js";
import { pruneValues, sameValues } from "./stored-values.js";

/**
 * Makes the database's content model match `target`, in one transaction, through the same
 * services the admin uses, so every rule (handles, field options, what may be deleted)
 * still applies. Callers decide beforehand which changes are allowed (see
 * model-sync.service.ts); this does all of them.
 *
 * Order matters: things others refer to are added first and removed last, so a content
 * type is made before the collection that uses it, and a taxonomy outlives the field that
 * chose from it. Values that no longer fit (of removed fields, of fields that changed type,
 * of removed block types) are taken out of entries and global sets, so nothing is left
 * that the next save would trip over.
 */
export async function applyModel(
  database: DatabaseOrTransaction,
  current: ContentModel,
  target: ContentModel,
): Promise<void> {
  await database.transaction(async (transaction) => {
    const step = new ModelApplier(transaction, current, target);
    await step.addAndRenameTaxonomies();
    await step.saveContentTypes();
    await step.saveCollections();
    await step.removeCollections();
    await step.removeUnits("contentType");
    await step.saveGlobalSets();
    await step.removeUnits("globalSet");
    await step.saveMenus();
    await step.removeUnits("menu");
    await step.removeUnits("taxonomy");
  });
}

class ModelApplier {
  constructor(
    private readonly database: DatabaseOrTransaction,
    private readonly current: ContentModel,
    private readonly target: ContentModel,
  ) {}

  private targetUnits<Kind extends ModelUnit["kind"]>(kind: Kind) {
    return sortedUnits(this.target).filter(
      (unit): unit is Extract<ModelUnit, { kind: Kind }> => unit.kind === kind,
    );
  }

  private before<Unit extends ModelUnit>(unit: Unit): Unit | undefined {
    return this.current.get(unitKey(unit)) as Unit | undefined;
  }

  async addAndRenameTaxonomies(): Promise<void> {
    for (const taxonomy of this.targetUnits("taxonomy")) {
      const before = this.before(taxonomy);
      if (!before) {
        // Content model files don't say which site owns a taxonomy: new ones are shared.
        await createTaxonomy(this.database, {
          handle: taxonomy.handle,
          name: taxonomy.name,
          siteHandle: null,
        });
      } else if (before.name !== taxonomy.name) {
        await updateTaxonomy(this.database, taxonomy.handle, { name: taxonomy.name });
      }
    }
  }

  async saveContentTypes(): Promise<void> {
    for (const contentType of this.targetUnits("contentType")) {
      const before = this.before(contentType);
      const { handle, name, fields } = contentType;
      if (!before) {
        await createBlueprint(this.database, { handle, name, fields });
        continue;
      }
      if (before.name === name && canonicalJson(before.fields) === canonicalJson(fields)) {
        continue;
      }
      await updateBlueprint(this.database, handle, { name, fields });
      await this.pruneEntries(before, fields);
    }
  }

  private async pruneEntries(before: ContentTypeUnit, fields: FieldDefinition[]): Promise<void> {
    const handles = before.collections.map((collection) => collection.handle);
    const collections = (await listCollectionModelRows(this.database, DEFAULT_TENANT_ID)).filter(
      (row) => handles.includes(row.handle),
    );
    const entries = await listEntryValues(
      this.database,
      collections.map((collection) => collection.id),
    );
    for (const entry of entries) {
      const data = pruneValues(before.fields, fields, entry.data);
      const publishedData =
        entry.publishedData && pruneValues(before.fields, fields, entry.publishedData);
      if (!sameValues(data, entry.data) || !sameValues(publishedData, entry.publishedData)) {
        await replaceEntryValues(this.database, entry.id, { data, publishedData });
      }
    }
  }

  async saveCollections(): Promise<void> {
    const existing = new Map<string, { owner: string; collection: ModelCollection }>();
    for (const unit of this.current.values()) {
      if (unit.kind === "contentType") {
        unit.collections.forEach((collection) =>
          existing.set(collection.handle, { owner: unit.handle, collection }),
        );
      }
    }
    for (const contentType of this.targetUnits("contentType")) {
      for (const collection of contentType.collections) {
        const { handle, name, structure, routePattern } = collection;
        const found = existing.get(handle);
        if (!found) {
          await createCollection(this.database, {
            handle,
            name,
            structure,
            routePattern,
            blueprintHandle: contentType.handle,
            // Content model files don't describe sites: new collections are on every site.
            siteScope: "per-site",
            siteHandles: null,
          });
        } else if (
          found.owner !== contentType.handle ||
          canonicalJson(found.collection) !== canonicalJson(collection)
        ) {
          await updateCollection(this.database, handle, {
            name,
            structure,
            routePattern,
            blueprintHandle: contentType.handle,
          });
        }
      }
    }
  }

  /** Collections no content type has any more, with their entries. */
  async removeCollections(): Promise<void> {
    const kept = new Set(
      this.targetUnits("contentType").flatMap((unit) =>
        unit.collections.map((collection) => collection.handle),
      ),
    );
    const rows = await listCollectionModelRows(this.database, DEFAULT_TENANT_ID);
    for (const unit of this.current.values()) {
      if (unit.kind !== "contentType") {
        continue;
      }
      for (const collection of unit.collections.filter(
        (candidate) => !kept.has(candidate.handle),
      )) {
        const row = rows.find((candidate) => candidate.handle === collection.handle);
        for (const entryId of row ? await listEntryIdsInCollection(this.database, row.id) : []) {
          await deleteEntry(this.database, entryId);
        }
        await deleteCollection(this.database, collection.handle);
      }
    }
  }

  async saveGlobalSets(): Promise<void> {
    for (const globalSet of this.targetUnits("globalSet")) {
      const before = this.before(globalSet);
      const { handle, name, fields } = globalSet;
      if (!before) {
        await createGlobalSet(this.database, { handle, name, fields });
      } else if (before.name !== name || canonicalJson(before.fields) !== canonicalJson(fields)) {
        await updateGlobalSet(this.database, handle, { name, fields });
        await this.pruneGlobalValues(handle, before.fields, fields);
      }
    }
  }

  private async pruneGlobalValues(
    handle: string,
    previousFields: FieldDefinition[],
    fields: FieldDefinition[],
  ): Promise<void> {
    const globalSet = (await listGlobalSetModelRows(this.database, DEFAULT_TENANT_ID)).find(
      (row) => row.handle === handle,
    );
    for (const row of globalSet ? await listGlobalValueRows(this.database, globalSet.id) : []) {
      const data = pruneValues(previousFields, fields, row.data);
      if (!sameValues(data, row.data)) {
        await replaceGlobalValuesData(this.database, row.id, data);
      }
    }
  }

  async saveMenus(): Promise<void> {
    for (const menu of this.targetUnits("menu")) {
      const before = this.before(menu);
      const { handle, name, maxDepth } = menu;
      if (!before) {
        await createNavigation(this.database, { handle, name, maxDepth });
      } else if (before.name !== name || before.maxDepth !== maxDepth) {
        await updateNavigation(this.database, handle, { name, maxDepth });
      }
    }
  }

  async removeUnits(kind: ModelUnit["kind"]): Promise<void> {
    for (const unit of sortedUnits(this.current).filter((candidate) => candidate.kind === kind)) {
      if (this.target.has(unitKey(unit))) {
        continue;
      }
      const remove = {
        contentType: deleteBlueprint,
        taxonomy: deleteTaxonomy,
        globalSet: deleteGlobalSet,
        menu: deleteNavigation,
      }[unit.kind];
      await remove(this.database, unit.handle);
    }
  }
}
