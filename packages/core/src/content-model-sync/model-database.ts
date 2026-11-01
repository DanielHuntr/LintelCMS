import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { type ContentModel, type ModelUnit, modelFromUnits } from "./content-model.schema.js";
import {
  listBlueprintModelRows,
  listCollectionModelRows,
  listFieldsetModelRows,
  listGlobalSetModelRows,
  listMenuModelRows,
  listTaxonomyModelRows,
} from "./content-model-sync.repository.js";

/** The content model as the database has it, in the same form files are read into. */
export async function readModelFromDatabase(
  database: DatabaseOrTransaction,
): Promise<ContentModel> {
  const [blueprints, collections, taxonomies, globalSets, menus, fieldsets] = await Promise.all([
    listBlueprintModelRows(database, DEFAULT_TENANT_ID),
    listCollectionModelRows(database, DEFAULT_TENANT_ID),
    listTaxonomyModelRows(database, DEFAULT_TENANT_ID),
    listGlobalSetModelRows(database, DEFAULT_TENANT_ID),
    listMenuModelRows(database, DEFAULT_TENANT_ID),
    listFieldsetModelRows(database, DEFAULT_TENANT_ID),
  ]);

  const units: ModelUnit[] = [
    ...blueprints.map((blueprint): ModelUnit => ({
      kind: "contentType",
      handle: blueprint.handle,
      name: blueprint.name,
      fields: blueprint.fields,
      collections: collections
        .filter((collection) => collection.blueprintId === blueprint.id)
        .map(({ handle, name, structure, routePattern }) => ({
          handle,
          name,
          structure,
          routePattern,
        })),
    })),
    ...taxonomies.map(({ handle, name }): ModelUnit => ({ kind: "taxonomy", handle, name })),
    ...globalSets.map(({ handle, name, fields }): ModelUnit => ({
      kind: "globalSet",
      handle,
      name,
      fields,
    })),
    ...fieldsets.map(({ handle, name, fields }): ModelUnit => ({
      kind: "fieldset",
      handle,
      name,
      fields,
    })),
    ...menus.map(({ handle, name, maxDepth }): ModelUnit => ({
      kind: "menu",
      handle,
      name,
      maxDepth,
    })),
  ];
  return modelFromUnits(units);
}
