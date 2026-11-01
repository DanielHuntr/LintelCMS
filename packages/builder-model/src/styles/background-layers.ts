import type { StyleDeclarations } from "../document/page-document.schema.js";
import { readUrlAddress, splitTopLevel, urlLayer } from "./style-values.js";

/**
 * A background is a stack of layers, top first: pictures, gradients and colour overlays,
 * over the background colour. The stylesheet keeps them as CSS does, as comma lists in the
 * same order (`background-image: linear-gradient(...), url(...)`, with matching
 * `background-size`, `background-position`...). These turn the lists into layers the
 * Style panel can show one by one, and back.
 */

export interface PictureLayer {
  kind: "picture";
  src: string;
  /** cover, contain, auto, or a size such as `50%`. */
  size: string;
  /** Where the picture's focal point sits: `30% 40%`. */
  position: string;
  repeat: string;
  /** `fixed` keeps the picture still while the page scrolls. */
  attachment: string;
}

export interface GradientLayer {
  kind: "gradient";
  gradient: Gradient;
}

export type BackgroundLayer = PictureLayer | GradientLayer;

export interface GradientStop {
  colour: string;
  /** Percent along the gradient. */
  at: number;
}

export interface Gradient {
  type: "linear" | "radial";
  /** Degrees, for linear gradients: 180 runs top to bottom. */
  angle: number;
  stops: GradientStop[];
}

export const backgroundLayerProperties = [
  "backgroundImage",
  "backgroundSize",
  "backgroundPosition",
  "backgroundRepeat",
  "backgroundAttachment",
] as const;

/** A picture covering the element, centred, as a new picture layer starts. */
export function pictureLayer(src: string): PictureLayer {
  return {
    kind: "picture",
    src,
    size: "cover",
    position: "50% 50%",
    repeat: "no-repeat",
    attachment: "scroll",
  };
}

/** A flat colour over everything below it, to keep text readable on a photo. */
export function overlayLayer(colour: string): GradientLayer {
  return {
    kind: "gradient",
    gradient: {
      type: "linear",
      angle: 180,
      stops: [
        { colour, at: 0 },
        { colour, at: 100 },
      ],
    },
  };
}

export function readBackgroundLayers(styles: StyleDeclarations): BackgroundLayer[] {
  const images = styles.backgroundImage ? splitTopLevel(styles.backgroundImage) : [];
  const listOf = (value: string | undefined) => (value ? splitTopLevel(value) : []);
  const sizes = listOf(styles.backgroundSize);
  const positions = listOf(styles.backgroundPosition);
  const repeats = listOf(styles.backgroundRepeat);
  const attachments = listOf(styles.backgroundAttachment);
  return images.flatMap((image, index): BackgroundLayer[] => {
    const address = readUrlAddress(image);
    if (address !== null) {
      return [
        {
          kind: "picture",
          src: address,
          size: sizes[index] ?? "auto",
          position: positions[index] ?? "0% 0%",
          repeat: repeats[index] ?? "repeat",
          attachment: attachments[index] ?? "scroll",
        },
      ];
    }
    const gradient = parseGradient(image);
    return gradient ? [{ kind: "gradient", gradient }] : [];
  });
}

/** The five background properties for a list of layers; all undefined when there are none. */
export function backgroundLayerStyles(
  layers: readonly BackgroundLayer[],
): Record<(typeof backgroundLayerProperties)[number], string | undefined> {
  if (layers.length === 0) {
    return {
      backgroundImage: undefined,
      backgroundSize: undefined,
      backgroundPosition: undefined,
      backgroundRepeat: undefined,
      backgroundAttachment: undefined,
    };
  }
  const each = (read: (layer: BackgroundLayer) => string) => layers.map(read).join(", ");
  const picture = (
    layer: BackgroundLayer,
    read: (picture: PictureLayer) => string,
    otherwise: string,
  ) => (layer.kind === "picture" ? read(layer) : otherwise);
  const hasPictures = layers.some((layer) => layer.kind === "picture");
  return {
    backgroundImage: each((layer) =>
      layer.kind === "picture" ? urlLayer(layer.src) : gradientValue(layer.gradient),
    ),
    backgroundSize: hasPictures
      ? each((layer) => picture(layer, (p) => p.size, "auto"))
      : undefined,
    backgroundPosition: hasPictures
      ? each((layer) => picture(layer, (p) => p.position, "0% 0%"))
      : undefined,
    backgroundRepeat: hasPictures
      ? each((layer) => picture(layer, (p) => p.repeat, "repeat"))
      : undefined,
    backgroundAttachment: layers.some(
      (layer) => layer.kind === "picture" && layer.attachment === "fixed",
    )
      ? each((layer) => picture(layer, (p) => p.attachment, "scroll"))
      : undefined,
  };
}

export function gradientValue(gradient: Gradient): string {
  const stops = gradient.stops.map((stop) => `${stop.colour} ${Math.round(stop.at)}%`).join(", ");
  return gradient.type === "linear"
    ? `linear-gradient(${Math.round(gradient.angle)}deg, ${stops})`
    : `radial-gradient(circle, ${stops})`;
}

/**
 * Reads gradients written by `gradientValue` (and simple hand-written ones). A gradient this
 * can't read is shown as text in Advanced, and left as it is.
 */
export function parseGradient(value: string): Gradient | null {
  const match = /^(linear|radial)-gradient\((.*)\)$/s.exec(value.trim());
  if (!match) return null;
  const type = match[1] as Gradient["type"];
  const parts = splitTopLevel(match[2] ?? "");
  let angle = 180;
  const first = parts[0] ?? "";
  if (type === "linear" && /^-?[\d.]+deg$/.test(first)) {
    angle = Number.parseFloat(first);
    parts.shift();
  } else if (type === "linear" && first.startsWith("to ")) {
    const directions: Record<string, number> = {
      "to top": 0,
      "to right": 90,
      "to bottom": 180,
      "to left": 270,
    };
    const direction = directions[first];
    if (direction === undefined) return null;
    angle = direction;
    parts.shift();
  } else if (type === "radial" && !looksLikeColourStop(first)) {
    parts.shift();
  }
  if (parts.length < 2) return null;
  const stops = parts.map((part, index): GradientStop | null => {
    const stop = /^(.*?)(?:\s+(-?[\d.]+)%)?$/s.exec(part);
    const colour = stop?.[1]?.trim() ?? "";
    if (colour === "") return null;
    const at = stop?.[2] !== undefined ? Number(stop[2]) : (index / (parts.length - 1)) * 100;
    return { colour, at };
  });
  return stops.every((stop) => stop !== null)
    ? { type, angle, stops: stops as GradientStop[] }
    : null;
}

function looksLikeColourStop(part: string): boolean {
  return (
    /^(#|rgb|hsl|oklch|var\(|transparent|[a-z]+\s+[\d.]+%$|[a-z]+$)/.test(part) &&
    !/^(circle|ellipse|closest|farthest)/.test(part)
  );
}
