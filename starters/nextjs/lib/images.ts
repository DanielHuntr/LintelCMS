import type { DeliveredImage } from "./content-types";

/**
 * Image URLs from Lintel. Lintel resizes images itself and, given both a width and a height,
 * crops them around the focal point the editor marked, so the subject stays in view.
 * The `v` in each URL changes when the image or its focal point does, so these URLs can be
 * cached for ever.
 */

export type ImageFormat = "webp" | "avif" | "jpeg" | "png";

export interface ImageSize {
  width: number;
  /** Leave out to keep the image's own shape. */
  height?: number;
  format?: ImageFormat;
}

/** Lintel won't make images larger than 4000 pixels, or larger than the original. */
const LARGEST_SIZE = 4000;

export function imageUrl(image: Pick<DeliveredImage, "url">, size: ImageSize): string {
  const url = new URL(image.url);
  url.searchParams.set("w", String(clampSize(size.width)));
  if (size.height !== undefined) {
    url.searchParams.set("h", String(clampSize(size.height)));
    url.searchParams.set("fit", "cover");
  }
  url.searchParams.set("format", size.format ?? "webp");
  return url.toString();
}

export interface ResponsiveImage {
  src: string;
  srcSet: string;
  width: number;
  height: number;
}

/** The widths offered to browsers; they pick one from `sizes`. */
export const DEFAULT_WIDTHS = [480, 768, 1080, 1440, 1920];

/**
 * A `src` and `srcSet` for an `<img>`, cropped to `aspectRatio` (width / height) around
 * the focal point. Widths larger than the original are left out, since they'd look the same.
 * Without an aspect ratio, the image keeps its own shape.
 */
export function responsiveImage(
  image: DeliveredImage,
  { aspectRatio, widths = DEFAULT_WIDTHS }: { aspectRatio?: number; widths?: number[] } = {},
): ResponsiveImage {
  const ownRatio = image.width && image.height ? image.width / image.height : undefined;
  const ratio = aspectRatio ?? ownRatio ?? 3 / 2;
  const usable = widths.filter((width) => image.width === null || width <= image.width);
  const offered = usable.length > 0 ? usable : [Math.min(widths[0] ?? 480, image.width ?? 480)];

  const sizeFor = (width: number): ImageSize => ({
    width,
    height: aspectRatio === undefined ? undefined : Math.round(width / ratio),
  });
  const largest = offered.at(-1) ?? 480;

  return {
    src: imageUrl(image, sizeFor(largest)),
    srcSet: offered.map((width) => `${imageUrl(image, sizeFor(width))} ${width}w`).join(", "),
    width: largest,
    height: Math.round(largest / ratio),
  };
}

function clampSize(size: number): number {
  return Math.min(LARGEST_SIZE, Math.max(1, Math.round(size)));
}
