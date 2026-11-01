import { z } from "zod";

/** The largest width or height a transform may ask for, so one request can't exhaust memory. */
export const MAX_TRANSFORM_DIMENSION = 4000;

export const assetKinds = ["image", "document"] as const;
export const transformFormats = ["webp", "avif", "jpeg", "png"] as const;

/** Query strings send `?search=` for "no search"; treat an empty value as left out. */
function optionalQueryValue<Schema extends z.ZodType>(schema: Schema) {
  return z.preprocess((value) => (value === "" ? undefined : value), schema.optional());
}

export const focalPointSchema = z.object({
  x: z.number({ error: "The focal point's x should be a number from 0 to 1" }).min(0).max(1),
  y: z.number({ error: "The focal point's y should be a number from 0 to 1" }).min(0).max(1),
});

/** What the API shows for an asset. `url` and `thumbnailUrl` are absolute, ready for an <img>. */
export const assetSchema = z.object({
  id: z.uuid(),
  filename: z.string(),
  mimeType: z.string(),
  size: z.number().int(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  alt: z.string(),
  focalPoint: focalPointSchema,
  url: z.string(),
  /** 400px wide, in WebP. Null for documents, which have no picture to shrink. */
  thumbnailUrl: z.string().nullable(),
  createdAt: z.iso.datetime(),
  uploadedBy: z.object({ id: z.uuid(), name: z.string() }).nullable(),
});

export const listAssetsQuerySchema = z.object({
  search: optionalQueryValue(z.string().trim().max(200)),
  type: optionalQueryValue(
    z.enum(assetKinds, { error: 'The type should be "image" or "document"' }),
  ),
  page: optionalQueryValue(z.coerce.number().int().min(1)).transform((page) => page ?? 1),
  perPage: optionalQueryValue(z.coerce.number().int().min(1).max(100)).transform(
    (perPage) => perPage ?? 25,
  ),
});

export const updateAssetRequestSchema = z.object({
  alt: z.string({ error: "Alt text should be text" }).trim().max(1000).optional(),
  focalPoint: focalPointSchema.optional(),
  filename: z
    .string({ error: "The filename should be text" })
    .trim()
    .min(1, { error: "Please enter a filename" })
    .max(200, { error: "Filenames can be at most 200 characters" })
    .optional(),
});

const transformDimension = optionalQueryValue(
  z.coerce
    .number({ error: "Width and height should be whole numbers of pixels" })
    .int({ error: "Width and height should be whole numbers of pixels" })
    .min(1, { error: "Width and height should be at least 1 pixel" })
    .max(MAX_TRANSFORM_DIMENSION, {
      error: `Width and height can be at most ${MAX_TRANSFORM_DIMENSION} pixels`,
    }),
);

export const fileTransformQuerySchema = z.object({
  w: transformDimension,
  h: transformDimension,
  fit: optionalQueryValue(
    z.enum(["cover", "contain"], { error: 'fit should be "cover" or "contain"' }),
  ).transform((fit) => fit ?? "cover"),
  format: optionalQueryValue(
    z.enum(transformFormats, { error: `format should be one of: ${transformFormats.join(", ")}` }),
  ),
  /** The asset's version, added to the URLs the API hands out (see image-transforms.ts). */
  v: optionalQueryValue(z.string().max(64)),
});

export const assetIdParamsSchema = z.object({
  id: z.uuid({ error: "That isn't a valid asset id" }),
});

export type Asset = z.infer<typeof assetSchema>;

/** Whether this server can resize images (sharp loads), and why not when it can't. */
export const imageResizingStatusSchema = z.object({
  available: z.boolean(),
  problem: z.string().nullable(),
});

export type ImageResizingStatus = z.infer<typeof imageResizingStatusSchema>;
export type FocalPoint = z.infer<typeof focalPointSchema>;
export type AssetKind = (typeof assetKinds)[number];
export type ListAssetsQuery = z.infer<typeof listAssetsQuerySchema>;
export type UpdateAssetRequest = z.infer<typeof updateAssetRequestSchema>;
export type FileTransformQuery = z.infer<typeof fileTransformQuerySchema>;
export type TransformFormat = (typeof transformFormats)[number];
