import type { DeliveredImage } from "../lib/content-types";
import { responsiveImage } from "../lib/images";

interface LintelImageProps {
  image: DeliveredImage;
  /** Width divided by height: 16 / 9 for a wide banner, 1 for a square. Leave out to keep the image's shape. */
  aspectRatio?: number;
  /** How wide the image shows, for the browser to pick a size: "(min-width: 768px) 50vw, 100vw". */
  sizes?: string;
  /** Load straight away, for the big image at the top of a page. */
  priority?: boolean;
  className?: string;
}

/**
 * A responsive image from Lintel, cropped around its focal point. Lintel does the resizing,
 * so this is a plain `<img>` and works on any host, with no image service to set up.
 */
export function LintelImage({
  image,
  aspectRatio,
  sizes = "100vw",
  priority = false,
  className,
}: LintelImageProps) {
  const { src, srcSet, width, height } = responsiveImage(image, { aspectRatio });
  return (
    // A plain <img> rather than next/image: Lintel has already resized and cropped it.
    <img
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      width={width}
      height={height}
      // Empty alt text marks the image as decorative, which is right when the editor left it blank.
      alt={image.alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={className}
    />
  );
}
