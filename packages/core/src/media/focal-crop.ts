/**
 * The geometry of cropping around a focal point, shared by the API (which crops with sharp)
 * and the admin (whose crop previews must match what the API will produce). Plain maths with
 * no imports, so the admin can load it from `@lintel/core/media-crop`.
 *
 * The rule: take the largest rectangle of the wanted shape that fits in the image, centre it
 * on the focal point, then slide it back inside the image where it would hang over an edge.
 */

/** Where the subject is: 0 to 1 across (x) and down (y). The centre is { x: 0.5, y: 0.5 }. */
export interface FocalPoint {
  x: number;
  y: number;
}

export interface CropRectangle {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The crop in pixels, for an image of the given size and a wanted width-to-height ratio. */
export function cropAroundFocalPoint(
  imageWidth: number,
  imageHeight: number,
  aspectRatio: number,
  focalPoint: FocalPoint,
): CropRectangle {
  const width = Math.max(1, Math.min(imageWidth, Math.round(imageHeight * aspectRatio)));
  const height = Math.max(1, Math.min(imageHeight, Math.round(imageWidth / aspectRatio)));

  return {
    left: clamp(Math.round(focalPoint.x * imageWidth - width / 2), 0, imageWidth - width),
    top: clamp(Math.round(focalPoint.y * imageHeight - height / 2), 0, imageHeight - height),
    width,
    height,
  };
}

/**
 * The same crop as CSS `object-position` fractions, for `object-fit: cover` previews.
 * CSS positions by how much of the overflow sits before the visible part, so 0 shows the
 * left (or top) edge and 1 the right (or bottom) edge.
 */
export function coverPositionForFocalPoint(
  imageAspectRatio: number,
  boxAspectRatio: number,
  focalPoint: FocalPoint,
): FocalPoint {
  const visibleWidth = Math.min(1, boxAspectRatio / imageAspectRatio);
  const visibleHeight = Math.min(1, imageAspectRatio / boxAspectRatio);

  return {
    x: positionAlongAxis(focalPoint.x, visibleWidth),
    y: positionAlongAxis(focalPoint.y, visibleHeight),
  };
}

function positionAlongAxis(focal: number, visibleFraction: number): number {
  const overflow = 1 - visibleFraction;
  if (overflow <= 0) {
    return 0.5;
  }
  const start = clamp(focal - visibleFraction / 2, 0, overflow);
  return start / overflow;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
