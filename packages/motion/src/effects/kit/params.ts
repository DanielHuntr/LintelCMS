import type { EffectParams } from "../effect-types.js";

/**
 * Reading a behaviour's parameters. The builder checks them when they are saved, but the
 * runtime still reads them defensively: a page saved by an older version may lack one.
 */

export function readNumber(params: EffectParams, name: string, fallback: number): number {
  const value = params[name];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function readText(params: EffectParams, name: string, fallback: string): string {
  const value = params[name];
  return typeof value === "string" ? value : fallback;
}

export function readSwitch(params: EffectParams, name: string, fallback: boolean): boolean {
  const value = params[name];
  return typeof value === "boolean" ? value : fallback;
}

/** A colour safe to put in a style: hex, rgb(), hsl() or a theme variable (with a hex fallback). */
export function readColour(params: EffectParams, name: string, fallback: string): string {
  const value = readText(params, name, fallback);
  return /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([\d\s.,%/-]+\)|var\(--[\w-]+(,\s*#[0-9a-f]{3,8})?\)|currentColor|transparent)$/i.test(
    value,
  )
    ? value
    : fallback;
}

/** A list typed as one line, "Fast, Friendly, Local": trimmed, empties dropped. */
export function readList(params: EffectParams, name: string, fallback: string): string[] {
  return readText(params, name, fallback)
    .split(/[,\n|]/)
    .map((item) => item.trim())
    .filter((item) => item !== "");
}
