import type { LinkValue, RichTextDocument, SelectChoice } from "./field.types.js";

/**
 * Entry data arrives from the API untyped, and an old entry may hold a value from before its
 * blueprint changed (a number where there is now text, say). These helpers read a value
 * safely as the shape each editor needs, falling back to "empty" rather than crashing.
 */

export function textValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** A number input's text as a stored value: blank (or not a number) means empty. */
export function numberFromInput(text: string): number | null {
  if (text.trim() === "") return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function booleanValue(value: unknown): boolean {
  return value === true;
}

/** The chosen values of a select, as a list whether it allows one choice or several. */
export function selectedValues(value: unknown): string[] {
  if (typeof value === "string") return value === "" ? [] : [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return [];
}

/** Adds or removes one choice, keeping the order the choices are listed in. */
export function toggleChoice(
  choices: readonly SelectChoice[],
  selected: readonly string[],
  choiceValue: string,
): string[] {
  const next = new Set(selected);
  if (next.has(choiceValue)) {
    next.delete(choiceValue);
  } else {
    next.add(choiceValue);
  }
  return choices.map((choice) => choice.value).filter((value) => next.has(value));
}

export function linkValue(value: unknown): LinkValue {
  if (typeof value === "object" && value !== null && "url" in value) {
    const { url, label } = value as { url: unknown; label?: unknown };
    return { url: textValue(url), label: textValue(label) };
  }
  return { url: "", label: "" };
}

/** A link with no address is no link at all, so it is stored as empty. */
export function linkFromInputs(url: string, label: string): LinkValue | null {
  if (url.trim() === "") return null;
  return label.trim() === "" ? { url: url.trim() } : { url: url.trim(), label };
}

export function assetIdValue(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

export const emptyRichTextDocument: RichTextDocument = { type: "doc", content: [] };

export function richTextValue(value: unknown): RichTextDocument {
  if (typeof value === "object" && value !== null && (value as { type?: unknown }).type === "doc") {
    return value as RichTextDocument;
  }
  return emptyRichTextDocument;
}
