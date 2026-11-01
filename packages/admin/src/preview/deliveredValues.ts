import type { LinkValue } from "../fields/field.types.js";
import type { DeliveredBlock, DeliveredImage } from "./preview.types.js";

/**
 * Delivered values arrive untyped, and a draft may hold anything a blueprint once allowed.
 * These read each one safely as the shape the built-in preview draws, or as "nothing".
 */

export function deliveredText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function deliveredRichText(value: unknown): string {
  if (typeof value === "object" && value !== null && "html" in value) {
    const { html } = value as { html: unknown };
    return typeof html === "string" ? html : "";
  }
  return "";
}

export function deliveredImage(value: unknown): DeliveredImage | null {
  if (typeof value !== "object" || value === null || !("url" in value)) return null;
  const image = value as Partial<DeliveredImage>;
  return typeof image.url === "string"
    ? {
        id: String(image.id ?? ""),
        url: image.url,
        alt: typeof image.alt === "string" ? image.alt : "",
        width: typeof image.width === "number" ? image.width : null,
        height: typeof image.height === "number" ? image.height : null,
      }
    : null;
}

export function deliveredLink(value: unknown): LinkValue | null {
  if (typeof value !== "object" || value === null || !("url" in value)) return null;
  const { url, label } = value as { url: unknown; label?: unknown };
  if (typeof url !== "string" || url === "") return null;
  return typeof label === "string" && label !== "" ? { url, label } : { url };
}

export function deliveredBlocks(value: unknown): DeliveredBlock[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (block): block is DeliveredBlock =>
      typeof block === "object" &&
      block !== null &&
      typeof (block as DeliveredBlock).id === "string" &&
      typeof (block as DeliveredBlock).type === "string" &&
      typeof (block as DeliveredBlock).data === "object",
  );
}
