import { checkBlueprintFields, checkFieldDefinitions } from "../blueprints/blueprint-fields.js";
import { defaultAllowedChildren } from "../collections/collections.schema.js";
import type { CollectionDefaults } from "../collections/collections.service.js";
import { blogPostsCollection, pagesCollection } from "../collections/default-collections.js";
import { siteSettingsGlobalSet } from "../globals/default-globals.js";
import { mainMenu } from "../navigation/default-navigation.js";
import { categoriesTaxonomy, tagsTaxonomy } from "../taxonomies/default-taxonomies.js";
import { type ContentModel, type ModelUnit, modelFromUnits } from "./content-model.schema.js";

/**
 * The content model a new site gets with the blog switched on: Pages, Blog posts, their
 * Categories and Tags, Site settings and the main menu. The Next.js starter's types are
 * generated from it (see starters/nextjs/lib/lintel.generated.ts).
 */
export function defaultContentModel(): ContentModel {
  const contentType = (defaults: CollectionDefaults): ModelUnit => ({
    kind: "contentType",
    handle: defaults.blueprint.handle,
    name: defaults.blueprint.name,
    fields: checkBlueprintFields(defaults.blueprint.fields),
    collections: [
      {
        handle: defaults.handle,
        name: defaults.name,
        structure: defaults.structure,
        routePattern: defaults.routePattern,
        allowedAtRoot: true,
        allowedChildren: defaultAllowedChildren(defaults.handle, defaults.structure),
        childrenAsCollection: false,
      },
    ],
  });
  return modelFromUnits([
    contentType(pagesCollection),
    contentType(blogPostsCollection),
    { kind: "taxonomy", handle: categoriesTaxonomy.handle, name: categoriesTaxonomy.name },
    { kind: "taxonomy", handle: tagsTaxonomy.handle, name: tagsTaxonomy.name },
    {
      kind: "globalSet",
      handle: siteSettingsGlobalSet.handle,
      name: siteSettingsGlobalSet.name,
      fields: checkFieldDefinitions(siteSettingsGlobalSet.fields),
    },
    { kind: "menu", ...mainMenu },
  ]);
}
