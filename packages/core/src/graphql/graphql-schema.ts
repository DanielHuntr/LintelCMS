import {
  type GraphQLFieldConfig,
  type GraphQLFieldConfigMap,
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  type GraphQLOutputType,
  GraphQLSchema,
  GraphQLString,
} from "graphql";
import { isDelivered } from "../delivery/delivered-values.js";
import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import { resolveEntrySeo } from "../seo/entry-seo.service.js";
import { listDeliveredRedirects } from "../seo/redirects.service.js";
import {
  blueprintFieldsTypeName,
  camelCaseName,
  collectionQueryNames,
  collectionTypeNames,
} from "./graphql-names.js";
import {
  assetListType,
  assetType,
  collectionType,
  entrySeoType,
  jsonScalar,
  linkType,
  redirectType,
  richTextType,
} from "./graphql-shared-types.js";
import type { CollectionWithBlueprint } from "./graphql.repository.js";
import {
  type ContentModel,
  findAsset,
  findCollectionEntry,
  type GraphqlContext,
  type GraphqlEntry,
  listCollectionEntries,
  listMedia,
  type PageArguments,
  toGraphqlError,
} from "./graphql.service.js";

/**
 * Builds the GraphQL schema from the content model, so every collection gets its own
 * typed queries:
 *
 *   pages(page: 1, perPage: 25, preview: false) { items { slug url data { title body { html } } } total }
 *   pagesEntry(slug: "about-us") { data { title hero_image { url(width: 800) alt } } }
 *
 * Field names in `data` are the blueprint's handles, exactly as the REST API uses them.
 */
export function buildGraphqlSchema(model: ContentModel): GraphQLSchema {
  const fieldsTypes = new Map<string, GraphQLObjectType>();
  const queryFields: GraphQLFieldConfigMap<unknown, GraphqlContext> = {
    collections: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(collectionType))),
      description: "Every collection, such as Pages and Blog posts.",
      resolve: () => model.collections,
    },
    asset: {
      type: assetType,
      description: "One file from the media library, by id.",
      args: { id: { type: new GraphQLNonNull(GraphQLID) } },
      resolve: (_source, args: { id: string }, context) => findAsset(context, args.id),
    },
    assets: {
      type: new GraphQLNonNull(assetListType),
      description: "The media library, newest first. Needs an API token.",
      args: {
        page: { type: new GraphQLNonNull(GraphQLInt), defaultValue: 1 },
        perPage: { type: new GraphQLNonNull(GraphQLInt), defaultValue: 25 },
        type: { type: assetKindEnum },
      },
      resolve: (
        _source,
        args: { page: number; perPage: number; type: "image" | "document" | null },
        context,
      ) => guard(() => listMedia(context, { ...args, type: args.type ?? null })),
    },
  };

  if (model.seoEnabled) {
    queryFields.redirects = {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(redirectType))),
      description: "The site's active redirects, for the website to follow.",
      resolve: async (_source, _args, context) =>
        (await listDeliveredRedirects(context.database)).redirects,
    };
  }

  for (const collection of model.collections) {
    const fieldsType = fieldsTypeFor(collection, fieldsTypes);
    const entryType = buildEntryType(collection, fieldsType, model.seoEnabled);
    const names = collectionQueryNames(collection.handle);
    queryFields[names.list] = buildListQuery(collection, entryType);
    queryFields[names.single] = buildSingleQuery(collection, entryType);
  }

  return new GraphQLSchema({
    query: new GraphQLObjectType({ name: "Query", fields: queryFields }),
  });
}

const assetKindEnum = new GraphQLEnumType({
  name: "AssetKind",
  values: { image: { value: "image" }, document: { value: "document" } },
});

const previewArgument = {
  type: new GraphQLNonNull(GraphQLBoolean),
  defaultValue: false,
  description:
    "Show saved drafts instead of what is published. Needs a preview link's token (the Lintel-Preview header) for that entry, a read-write API token, or an admin session.",
};

const localeArgument = {
  type: GraphQLString,
  description: 'A language code such as "fr". Leave out for the site\'s main language.',
};

function buildListQuery(
  collection: CollectionWithBlueprint,
  entryType: GraphQLObjectType,
): GraphQLFieldConfig<unknown, GraphqlContext> {
  const listType = new GraphQLObjectType({
    name: collectionTypeNames(collection.handle).list,
    fields: {
      items: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(entryType))) },
      total: { type: new GraphQLNonNull(GraphQLInt) },
    },
  });
  return {
    type: new GraphQLNonNull(listType),
    description: `Entries in ${collection.name}, a page at a time.`,
    args: {
      page: { type: new GraphQLNonNull(GraphQLInt), defaultValue: 1 },
      perPage: { type: new GraphQLNonNull(GraphQLInt), defaultValue: 25 },
      preview: previewArgument,
      locale: localeArgument,
    },
    resolve: (_source, args: PageArguments, context) =>
      guard(() => listCollectionEntries(context, collection, args)),
  };
}

function buildSingleQuery(
  collection: CollectionWithBlueprint,
  entryType: GraphQLObjectType,
): GraphQLFieldConfig<unknown, GraphqlContext> {
  return {
    type: entryType,
    description: `One entry in ${collection.name}, by its slug. Null when there is none.`,
    args: {
      slug: { type: new GraphQLNonNull(GraphQLString) },
      preview: previewArgument,
      locale: localeArgument,
    },
    resolve: (_source, args: { slug: string; preview: boolean; locale?: string | null }, context) =>
      guard(() => findCollectionEntry(context, collection, args.slug, args.preview, args.locale)),
  };
}

function buildEntryType(
  collection: CollectionWithBlueprint,
  fieldsType: GraphQLObjectType,
  seoEnabled: boolean,
): GraphQLObjectType<GraphqlEntry, GraphqlContext> {
  const fields: GraphQLFieldConfigMap<GraphqlEntry, GraphqlContext> = {
    id: { type: new GraphQLNonNull(GraphQLID) },
    slug: { type: new GraphQLNonNull(GraphQLString) },
    url: {
      type: GraphQLString,
      description: "The entry's page on the site, from the route pattern.",
    },
    status: { type: new GraphQLNonNull(GraphQLString) },
    publishedAt: { type: GraphQLString },
    data: { type: new GraphQLNonNull(fieldsType) },
  };
  if (seoEnabled) {
    fields.seo = {
      type: new GraphQLNonNull(entrySeoType),
      resolve: (entry, _args, context) =>
        resolveEntrySeo(context.database, entry, context.assetLookup, context.site),
    };
  }
  return new GraphQLObjectType({ name: collectionTypeNames(collection.handle).entry, fields });
}

/** Collections that share a blueprint share its fields type too. */
function fieldsTypeFor(
  collection: CollectionWithBlueprint,
  built: Map<string, GraphQLObjectType>,
): GraphQLObjectType {
  const existing = built.get(collection.blueprint.handle);
  if (existing) {
    return existing;
  }
  const fieldsType = new GraphQLObjectType<Record<string, unknown>>({
    name: blueprintFieldsTypeName(collection.blueprint.handle),
    fields: () => {
      const fields: GraphQLFieldConfigMap<Record<string, unknown>, GraphqlContext> = {};
      for (const field of collection.blueprint.fields.filter(isDelivered)) {
        fields[field.handle] = {
          type: graphqlTypeFor(field),
          description: field.helpText || field.label,
        };
      }
      // GraphQL types need at least one field; a blueprint can briefly have none.
      if (Object.keys(fields).length === 0) {
        fields[camelCaseName("no_fields_yet")] = { type: GraphQLBoolean, resolve: () => null };
      }
      return fields;
    },
  });
  built.set(collection.blueprint.handle, fieldsType);
  return fieldsType;
}

const stringList = new GraphQLList(new GraphQLNonNull(GraphQLString));

function graphqlTypeFor(field: FieldDefinition): GraphQLOutputType {
  switch (field.type) {
    case "text":
    case "textarea":
    case "date":
    case "time":
    case "slug":
    case "code":
    case "icon":
    case "radio":
    case "buttonGroup":
      return GraphQLString;
    case "range":
      return GraphQLFloat;
    case "checkboxes":
      return stringList;
    case "table":
      return new GraphQLList(new GraphQLNonNull(stringList));
    case "richText":
      return richTextType;
    case "number":
      return GraphQLFloat;
    case "toggle":
      return GraphQLBoolean;
    case "select":
      return field.options.multiple === true
        ? new GraphQLList(new GraphQLNonNull(GraphQLString))
        : GraphQLString;
    case "image":
      return assetType;
    case "link":
      return linkType;
    default:
      return jsonScalar;
  }
}

async function guard<Result>(run: () => Promise<Result>): Promise<Result> {
  try {
    return await run();
  } catch (error) {
    throw toGraphqlError(error);
  }
}
