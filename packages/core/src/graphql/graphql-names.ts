/**
 * GraphQL names made from handles. Handles are already safe ("blog_posts"), so this only
 * changes their case to what GraphQL users expect: `blogPosts` for fields and
 * `BlogPosts` for types.
 */

/** Query fields Lintel defines itself; a collection with one of these handles gets "Entries" added. */
const builtInQueryFields = new Set(["collections", "asset", "assets", "redirects"]);

export function camelCaseName(handle: string): string {
  return handle.replace(/_+([a-z0-9])/g, (_match, letter: string) => letter.toUpperCase());
}

export function pascalCaseName(handle: string): string {
  const camel = camelCaseName(handle);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/** `pages` lists a collection, and `pagesEntry(slug:)` finds one entry in it. */
export function collectionQueryNames(collectionHandle: string): { list: string; single: string } {
  const camel = camelCaseName(collectionHandle);
  const list = builtInQueryFields.has(camel) ? `${camel}Entries` : camel;
  return { list, single: `${camel}Entry` };
}

/** `PagesEntry` and `PagesEntryList` for a collection; `PageFields` for its blueprint's fields. */
export function collectionTypeNames(collectionHandle: string): { entry: string; list: string } {
  const pascal = pascalCaseName(collectionHandle);
  return { entry: `${pascal}Entry`, list: `${pascal}EntryList` };
}

export function blueprintFieldsTypeName(blueprintHandle: string): string {
  return `${pascalCaseName(blueprintHandle)}Fields`;
}
