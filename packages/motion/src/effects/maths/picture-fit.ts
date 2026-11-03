/**
 * Where a picture's pixels land in its box, the way CSS `object-fit` and `object-position`
 * place them, so an effect drawn over a picture lines up with the picture exactly.
 */

export type PictureFit = "cover" | "contain" | "fill" | "none" | "scale-down";

export interface FittedPicture {
  /** The part of the picture shown, in the picture's own pixels. */
  source: { x: number; y: number; width: number; height: number };
  /** Where it is drawn in the box, in the box's pixels. */
  target: { x: number; y: number; width: number; height: number };
}

/**
 * `position` is object-position as two fractions (0.5, 0.5 is the middle). "none" and
 * "scale-down" are treated as "contain", which is what they nearly always look like.
 */
export function fitPicture(
  picture: { width: number; height: number },
  box: { width: number; height: number },
  fit: PictureFit = "fill",
  position: readonly [number, number] = [0.5, 0.5],
): FittedPicture {
  const whole = { x: 0, y: 0, width: picture.width, height: picture.height };
  const all = { x: 0, y: 0, width: box.width, height: box.height };
  if (fit === "fill" || picture.width <= 0 || picture.height <= 0) {
    return { source: whole, target: all };
  }
  const scale =
    fit === "cover"
      ? Math.max(box.width / picture.width, box.height / picture.height)
      : Math.min(box.width / picture.width, box.height / picture.height);
  if (fit === "cover") {
    const width = box.width / scale;
    const height = box.height / scale;
    return {
      source: {
        x: (picture.width - width) * position[0],
        y: (picture.height - height) * position[1],
        width,
        height,
      },
      target: all,
    };
  }
  const width = picture.width * scale;
  const height = picture.height * scale;
  return {
    source: whole,
    target: {
      x: (box.width - width) * position[0],
      y: (box.height - height) * position[1],
      width,
      height,
    },
  };
}

/** object-position from CSS ("50% 30%", "left top") as two fractions; the middle otherwise. */
export function readObjectPosition(css: string): [number, number] {
  const words: Record<string, number> = { left: 0, top: 0, center: 0.5, right: 1, bottom: 1 };
  const parts = css.trim().split(/\s+/);
  const read = (part: string | undefined) => {
    if (part === undefined) return 0.5;
    if (part in words) return words[part]!;
    const percent = /^(-?[\d.]+)%$/.exec(part)?.[1];
    return percent === undefined ? 0.5 : Math.min(1, Math.max(0, Number(percent) / 100));
  };
  return [read(parts[0]), read(parts[1])];
}
