import { createCollection } from "../content/content.api.js";
import type { Collection, CollectionStructure } from "../content/content.types.js";
import { titleFieldHandle, type Field } from "../fields/field.types.js";
import { t } from "../i18n/strings.js";
import { createBlueprint } from "./blueprints.api.js";
import type { Blueprint } from "./blueprints.types.js";
import { handleFromLabel } from "./handle.js";

/** Every new content type starts with just the required title. */
function startingFields(): Field[] {
  return [
    {
      handle: titleFieldHandle,
      label: t("builder.titleLabel"),
      type: "text",
      required: true,
      options: {},
    },
  ];
}

/** "Team members" becomes the handle "team_members". */
export function contentTypeHandle(name: string): string {
  return handleFromLabel(name, "type");
}

/**
 * Where entries live on the site. Pages follow the tree ("/about", and "/about/team" for a
 * page under About); posts and lists get a folder named after the collection ("/team-members/ada").
 */
export function routePatternFor(handle: string, structure: CollectionStructure): string {
  return structure === "tree" ? "/{path}" : `/${handle.replace(/_/g, "-")}/{slug}`;
}

/** A content type is a blueprint (its fields) and a collection (where its entries live). This is the first. */
export function createContentTypeBlueprint(name: string): Promise<Blueprint> {
  return createBlueprint({ handle: contentTypeHandle(name), name, fields: startingFields() });
}

/** The second half of a content type: the collection its entries are kept in. */
export function createContentTypeCollection(
  name: string,
  structure: CollectionStructure,
): Promise<Collection> {
  const handle = contentTypeHandle(name);
  return createCollection({
    handle,
    name,
    blueprintHandle: handle,
    structure,
    routePattern: routePatternFor(handle, structure),
  });
}
