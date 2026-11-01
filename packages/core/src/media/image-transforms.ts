import { createHash } from "node:crypto";
import type { Sharp } from "sharp";
import { cropAroundFocalPoint } from "./focal-crop.js";
import { loadImageLibrary } from "./image-library.js";
import { UnreadableImageError } from "./media.errors.js";
import type { FileTransformQuery, TransformFormat } from "./media.schema.js";
import type { AssetRow } from "./media.table.js";

/**
 * Resizing and converting images with sharp. Results are cached on disk by the caller
 * (transform-cache.ts) under `transformCacheKey`, so each size is only ever made once.
 */

export type ImageTransform = Required<Pick<FileTransformQuery, "fit">> &
  Pick<FileTransformQuery, "w" | "h" | "format">;

type TransformableAsset = Pick<
  AssetRow,
  "filename" | "mimeType" | "width" | "height" | "focalX" | "focalY" | "contentHash"
>;

/**
 * The most pixels an image may have: 100 megapixels, more than any phone or most cameras
 * take. Decoding needs about 4 bytes a pixel, so a small file that claims to be enormous
 * (a "decompression bomb") would otherwise take gigabytes of memory to resize. Uploads
 * above it are refused, and sharp refuses to decode anything above it all the same.
 */
export const MAX_IMAGE_PIXELS = 100_000_000;

const mimeTypeByFormat: Record<TransformFormat, string> = {
  webp: "image/webp",
  avif: "image/avif",
  jpeg: "image/jpeg",
  png: "image/png",
};

/**
 * The size people see, after the camera's rotation is applied. Undefined when sharp can't
 * read the image at all (or isn't available on this server); for animations, the height
 * of one frame.
 */
export async function readImageSize(
  contents: Buffer,
): Promise<{ width: number; height: number } | undefined> {
  const library = await loadImageLibrary();
  if (!library.available) return undefined;
  const sharp = library.sharp;
  try {
    // Only the header is read here, so even a huge image is cheap to measure.
    const metadata = await sharp(contents, { limitInputPixels: false }).metadata();
    // Animations report the height of every frame stacked; one frame is what people see.
    const isAnimated = (metadata.pages ?? 1) > 1 && metadata.pageHeight !== undefined;
    return {
      width: metadata.autoOrient.width,
      height: isAnimated ? (metadata.pageHeight ?? 0) : metadata.autoOrient.height,
    };
  } catch {
    return undefined;
  }
}

/** True when the request asks for anything other than the original file. */
export function wantsTransform(query: FileTransformQuery): boolean {
  return query.w !== undefined || query.h !== undefined || query.format !== undefined;
}

/**
 * Identifies one result. The focal point only changes cover crops with both a width and a
 * height, so it is only part of the key for those; other sizes survive focal point edits.
 */
export function transformCacheKey(asset: TransformableAsset, transform: ImageTransform): string {
  const crops = isFocalCrop(transform) ? `${asset.focalX},${asset.focalY}` : "";
  return createHash("sha256")
    .update(
      [
        asset.contentHash,
        transform.w,
        transform.h,
        transform.fit,
        outputFormat(asset, transform),
        crops,
      ].join("|"),
    )
    .digest("hex")
    .slice(0, 32);
}

export function transformMimeType(asset: TransformableAsset, transform: ImageTransform): string {
  return mimeTypeByFormat[outputFormat(asset, transform)];
}

/** Makes the resized image. Images are never enlarged: asking for 4000px of a 1000px photo gives 1000px. */
export async function renderTransform(
  original: Buffer,
  asset: TransformableAsset,
  transform: ImageTransform,
): Promise<Buffer> {
  const library = await loadImageLibrary();
  if (!library.available) return original;
  const sharp = library.sharp;
  // autoOrient applies the camera's rotation first, so crops use the same corners editors see.
  const image = sharp(original, { autoOrient: true, limitInputPixels: MAX_IMAGE_PIXELS });

  if (isFocalCrop(transform) && asset.width && asset.height) {
    const crop = cropAroundFocalPoint(asset.width, asset.height, transform.w / transform.h, {
      x: asset.focalX,
      y: asset.focalY,
    });
    image
      .extract(crop)
      .resize({ width: transform.w, height: transform.h, fit: "fill", withoutEnlargement: true });
  } else if (transform.w !== undefined || transform.h !== undefined) {
    // "inside" keeps the whole image within the box without padding it, which is what
    // `contain` means for a delivered file (CSS adds letterboxing when it's wanted).
    image.resize({
      width: transform.w,
      height: transform.h,
      fit: transform.fit === "contain" ? "inside" : "cover",
      withoutEnlargement: true,
    });
  }

  try {
    return await encode(image, outputFormat(asset, transform)).toBuffer();
  } catch {
    throw new UnreadableImageError(asset.filename);
  }
}

function isFocalCrop(
  transform: ImageTransform,
): transform is ImageTransform & { w: number; h: number } {
  return transform.fit === "cover" && transform.w !== undefined && transform.h !== undefined;
}

/** The format asked for, or the original's when it is one sharp writes well. SVG becomes PNG. */
function outputFormat(asset: TransformableAsset, transform: ImageTransform): TransformFormat {
  if (transform.format) {
    return transform.format;
  }
  const original = Object.entries(mimeTypeByFormat).find(
    ([, mimeType]) => mimeType === asset.mimeType,
  );
  return original ? (original[0] as TransformFormat) : "png";
}

function encode(image: Sharp, format: TransformFormat): Sharp {
  switch (format) {
    case "webp":
      return image.webp({ quality: 80 });
    case "avif":
      return image.avif({ quality: 55 });
    case "jpeg":
      // JPEG has no transparency; without a background, transparent areas turn black.
      return image.flatten({ background: "#ffffff" }).jpeg({ quality: 82, mozjpeg: true });
    case "png":
      return image.png();
  }
}
