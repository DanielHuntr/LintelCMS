import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLString,
  valueFromASTUntyped,
} from "graphql";
import type { DeliveredAsset } from "../fieldtypes/image-assets.js";

/**
 * The GraphQL types every schema shares, whatever the blueprints say: assets, rich text,
 * links and collections. Blueprint-specific types are built in graphql-schema.ts.
 */

/** Any JSON value, for rich text's editor JSON and fields of an unknown type. */
export const jsonScalar = new GraphQLScalarType({
  name: "JSON",
  description: "Any JSON value.",
  serialize: (value) => value,
  parseValue: (value) => value,
  parseLiteral: (ast) => valueFromASTUntyped(ast),
});

const focalPointType = new GraphQLObjectType({
  name: "FocalPoint",
  description: "Where the subject of an image is, from 0 to 1 across and down.",
  fields: {
    x: { type: new GraphQLNonNull(GraphQLFloat) },
    y: { type: new GraphQLNonNull(GraphQLFloat) },
  },
});

const imageFitEnum = new GraphQLEnumType({
  name: "ImageFit",
  values: { cover: { value: "cover" }, contain: { value: "contain" } },
});

const imageFormatEnum = new GraphQLEnumType({
  name: "ImageFormat",
  values: {
    webp: { value: "webp" },
    avif: { value: "avif" },
    jpeg: { value: "jpeg" },
    png: { value: "png" },
  },
});

interface ImageTransform {
  width?: number | null;
  height?: number | null;
  fit?: string | null;
  format?: string | null;
}

/** The asset's URL with a resize added, using the media library's `?w=&h=&fit=&format=`. */
export function transformedAssetUrl(url: string, transform: ImageTransform): string {
  const transformed = new URL(url);
  const settings: [string, unknown][] = [
    ["w", transform.width],
    ["h", transform.height],
    ["fit", transform.fit],
    ["format", transform.format],
  ];
  for (const [key, value] of settings) {
    if (value !== undefined && value !== null) {
      transformed.searchParams.set(key, String(value));
    }
  }
  return transformed.href;
}

export const assetType = new GraphQLObjectType<DeliveredAsset>({
  name: "Asset",
  description: "A file from the media library.",
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    url: {
      type: new GraphQLNonNull(GraphQLString),
      description: "The file's address. Give a width or height to get a resized copy of an image.",
      args: {
        width: { type: GraphQLInt },
        height: { type: GraphQLInt },
        fit: { type: imageFitEnum },
        format: { type: imageFormatEnum },
      },
      resolve: (asset, transform: ImageTransform) => transformedAssetUrl(asset.url, transform),
    },
    alt: { type: new GraphQLNonNull(GraphQLString) },
    width: { type: GraphQLInt },
    height: { type: GraphQLInt },
    focalPoint: { type: focalPointType },
  },
});

export const assetListType = new GraphQLObjectType({
  name: "AssetList",
  fields: {
    items: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(assetType))) },
    total: { type: new GraphQLNonNull(GraphQLInt) },
  },
});

export const richTextType = new GraphQLObjectType({
  name: "RichText",
  description: "Formatted text: ready-made HTML, and the editor's JSON for custom rendering.",
  fields: {
    html: { type: new GraphQLNonNull(GraphQLString) },
    json: { type: new GraphQLNonNull(jsonScalar) },
  },
});

export const linkType = new GraphQLObjectType({
  name: "Link",
  fields: {
    url: { type: new GraphQLNonNull(GraphQLString) },
    label: { type: GraphQLString },
    entryId: {
      type: GraphQLID,
      description: "The page linked to, when the link was made with Choose a page.",
    },
  },
});

export const collectionType = new GraphQLObjectType({
  name: "Collection",
  fields: {
    handle: { type: new GraphQLNonNull(GraphQLString) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    structure: { type: new GraphQLNonNull(GraphQLString) },
    routePattern: { type: GraphQLString },
  },
});

const seoImageType = new GraphQLObjectType({
  name: "SeoImage",
  description: "The picture social networks show when the page is shared.",
  fields: {
    url: { type: new GraphQLNonNull(GraphQLString) },
    alt: { type: new GraphQLNonNull(GraphQLString) },
    width: { type: GraphQLInt },
    height: { type: GraphQLInt },
  },
});

export const entrySeoType = new GraphQLObjectType({
  name: "EntrySeo",
  description: "What to put in the page's <head>, with the site's SEO defaults filled in.",
  fields: {
    title: { type: new GraphQLNonNull(GraphQLString) },
    description: { type: new GraphQLNonNull(GraphQLString) },
    canonicalUrl: { type: GraphQLString },
    image: { type: seoImageType },
    noindex: { type: new GraphQLNonNull(GraphQLBoolean) },
  },
});

export const redirectType = new GraphQLObjectType({
  name: "Redirect",
  fields: {
    from: { type: new GraphQLNonNull(GraphQLString) },
    to: { type: new GraphQLNonNull(GraphQLString) },
    statusCode: { type: new GraphQLNonNull(GraphQLInt) },
  },
});
