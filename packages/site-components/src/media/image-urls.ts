import type { SiteImage } from "../site.types.js";

/**
 * Addresses of resized copies of a picture. Lintel's media server crops around the
 * picture's focal point when it is given both a width and a height, so asking for a shape
 * here is all a component does to get a well-framed crop (see packages/core/src/media).
 */

/** The widths offered to browsers in `srcset`. Each is made once and then cached. */
export const IMAGE_WIDTHS = [480, 768, 1080, 1440, 1920, 2560] as const;

/** The largest copy ever asked for: wide enough for a full-width picture on a large screen. */
const LARGEST_WIDTH = 2560;

/** Width divided by height, such as 16 / 9. Null keeps the picture's own shape. */
export type AspectRatio = number | null;

export interface ImageSource {
  url: string;
  width: number;
  height: number | null;
}

/** The address of one resized (and, with a ratio, cropped) copy, as WebP. */
export function resizedImageUrl(image: SiteImage, width: number, aspectRatio: AspectRatio): string {
  const parameters = new URLSearchParams({ w: String(width) });
  if (aspectRatio !== null) {
    parameters.set("h", String(Math.round(width / aspectRatio)));
    parameters.set("fit", "cover");
  }
  parameters.set("format", "webp");
  const separator = image.url.includes("?") ? "&" : "?";
  return `${image.url}${separator}${parameters.toString()}`;
}

/**
 * The copies worth offering: every standard width up to the original's, plus the original
 * width itself when it falls between two, so a small picture is never blown up.
 */
export function imageSources(image: SiteImage, aspectRatio: AspectRatio): ImageSource[] {
  const originalWidth = image.width ?? LARGEST_WIDTH;
  const widths: number[] = IMAGE_WIDTHS.filter((width) => width < originalWidth);
  widths.push(Math.min(originalWidth, LARGEST_WIDTH));
  return widths.map((width) => ({
    url: resizedImageUrl(image, width, aspectRatio),
    width,
    height: heightFor(image, width, aspectRatio),
  }));
}

export function srcSet(sources: readonly ImageSource[]): string {
  return sources.map((source) => `${source.url} ${source.width}w`).join(", ");
}

/**
 * The height that goes with a width, so the browser can save the space before the picture
 * arrives (no layout shift). Unknown when neither a ratio nor the original size is known.
 */
export function heightFor(
  image: SiteImage,
  width: number,
  aspectRatio: AspectRatio,
): number | null {
  if (aspectRatio !== null) {
    return Math.round(width / aspectRatio);
  }
  if (image.width && image.height) {
    return Math.round((width * image.height) / image.width);
  }
  return null;
}
