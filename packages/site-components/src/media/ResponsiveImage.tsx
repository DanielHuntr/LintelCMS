import type { SiteImage } from "../site.types.js";
import { type AspectRatio, heightFor, imageSources, srcSet } from "./image-urls.js";

export interface ResponsiveImageProps {
  image: SiteImage;
  /** Crop to this shape (width / height) around the focal point; null keeps the original. */
  aspectRatio?: AspectRatio;
  /** A different shape for phones, such as 4 / 5 for a tall hero. Adds a `<picture>`. */
  phoneAspectRatio?: AspectRatio;
  /** How wide the picture is shown, for the browser to pick a size: "100vw". */
  sizes?: string;
  /** For the first picture on the page: loads straight away instead of lazily. */
  priority?: boolean;
  className?: string;
  /** Names the field this picture comes from, for the page builder. */
  field?: string;
}

/** Phones are screens up to this width, the same breakpoint the styles use. */
const PHONE_MEDIA = "(max-width: 40rem)";

/**
 * A picture in several sizes, with its width and height set so the page doesn't jump as it
 * loads. Output: `<img class srcset sizes width height alt loading decoding>`, wrapped in a
 * `<picture>` only when phones get a different crop.
 */
export function ResponsiveImage({
  image,
  aspectRatio = null,
  phoneAspectRatio,
  sizes = "100vw",
  priority = false,
  className,
  field,
}: ResponsiveImageProps) {
  const sources = imageSources(image, aspectRatio);
  const largest = sources[sources.length - 1];
  const width = largest?.width ?? image.width ?? undefined;
  const height = largest ? (heightFor(image, largest.width, aspectRatio) ?? undefined) : undefined;

  const img = (
    <img
      className={className}
      src={largest?.url ?? image.url}
      srcSet={srcSet(sources)}
      sizes={sizes}
      width={width}
      height={height}
      alt={image.alt}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : undefined}
      data-lintel-image={field}
    />
  );

  if (phoneAspectRatio === undefined) {
    return img;
  }
  const phoneSources = imageSources(image, phoneAspectRatio);
  const phoneLargest = phoneSources[phoneSources.length - 1];
  return (
    <picture>
      <source
        media={PHONE_MEDIA}
        srcSet={srcSet(phoneSources)}
        sizes={sizes}
        width={phoneLargest?.width}
        height={
          phoneLargest
            ? (heightFor(image, phoneLargest.width, phoneAspectRatio) ?? undefined)
            : undefined
        }
      />
      {img}
    </picture>
  );
}
