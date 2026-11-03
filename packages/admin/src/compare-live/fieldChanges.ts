import { isSameValue } from "../content/sameValue.js";
import type { Field, FieldType } from "../fields/field.types.js";
import { assetIdValue } from "../fields/fieldValues.js";
import { type DiffPart, diffWords } from "./textDiff.js";

/**
 * How one field differs between the live version and the saved one:
 * - `text`: the words, marked where they were removed or added;
 * - `picture`: the live and the new picture (either may be none);
 * - `design`: a page design, which is shown as "Design changed" with a link to the live page;
 * - `value`: a short value each side, such as a choice's label or "On";
 * - `other`: something without a sensible text form (a list of blocks, say): "Changed".
 */
export type FieldChange =
  | { handle: string; label: string; kind: "text"; parts: DiffPart[] }
  | { handle: string; label: string; kind: "picture"; before: string | null; after: string | null }
  | { handle: string; label: string; kind: "design" }
  | { handle: string; label: string; kind: "value"; before: string; after: string }
  | { handle: string; label: string; kind: "other" };

/** Fields that only arrange the editor and never hold a value. */
const layoutTypes: readonly FieldType[] = ["tab", "section", "spacer", "revealer"];
const textTypes: readonly FieldType[] = [
  "text",
  "textarea",
  "markdown",
  "slug",
  "email",
  "url",
  "code",
];
const valueTypes: readonly FieldType[] = [
  "number",
  "toggle",
  "select",
  "radio",
  "buttonGroup",
  "checkboxes",
  "date",
  "time",
  "range",
  "colour",
  "link",
];

export interface ValueWords {
  on: string;
  off: string;
  empty: string;
}

/**
 * Every field whose saved value differs from the live one, in the content type's order.
 * Values for fields no longer in the content type are listed after, by their handle, so
 * nothing that would change on the site goes unmentioned.
 */
export function listFieldChanges(
  fields: readonly Field[],
  live: Readonly<Record<string, unknown>>,
  saved: Readonly<Record<string, unknown>>,
  words: ValueWords,
): FieldChange[] {
  const changes: FieldChange[] = [];
  const seen = new Set<string>();
  for (const field of fields) {
    if (layoutTypes.includes(field.type)) continue;
    seen.add(field.handle);
    const before = live[field.handle];
    const after = saved[field.handle];
    if (isSameValue(before ?? null, after ?? null)) continue;
    changes.push(describeChange(field, before, after, words));
  }
  const otherHandles = new Set([...Object.keys(live), ...Object.keys(saved)]);
  for (const handle of otherHandles) {
    if (seen.has(handle) || isSameValue(live[handle] ?? null, saved[handle] ?? null)) continue;
    changes.push({ handle, label: handle, kind: "other" });
  }
  return changes;
}

function describeChange(
  field: Field,
  before: unknown,
  after: unknown,
  words: ValueWords,
): FieldChange {
  const { handle, label } = field;
  if (field.type === "page") return { handle, label, kind: "design" };
  if (field.type === "image") {
    return {
      handle,
      label,
      kind: "picture",
      before: assetIdValue(before),
      after: assetIdValue(after),
    };
  }
  if (textTypes.includes(field.type)) {
    return { handle, label, kind: "text", parts: diffWords(plainText(before), plainText(after)) };
  }
  if (field.type === "richText") {
    return {
      handle,
      label,
      kind: "text",
      parts: diffWords(richTextAsPlainText(before), richTextAsPlainText(after)),
    };
  }
  if (valueTypes.includes(field.type)) {
    const beforeText = describeValue(field, before, words);
    const afterText = describeValue(field, after, words);
    if (beforeText !== undefined && afterText !== undefined) {
      return { handle, label, kind: "value", before: beforeText, after: afterText };
    }
  }
  return { handle, label, kind: "other" };
}

function plainText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** A short text for a simple value, or undefined when it has none. */
function describeValue(field: Field, value: unknown, words: ValueWords): string | undefined {
  if (value === null || value === undefined || value === "") return words.empty;
  if (typeof value === "boolean") return value ? words.on : words.off;
  const choiceLabel = (choice: unknown) =>
    field.options.choices?.find((option) => option.value === choice)?.label ?? String(choice);
  if (typeof value === "string" || typeof value === "number") return choiceLabel(value);
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value.length === 0 ? words.empty : value.map(choiceLabel).join(", ");
  }
  if (typeof value === "object" && "url" in value && typeof value.url === "string") {
    const linkLabel = "label" in value && typeof value.label === "string" ? value.label : "";
    return linkLabel ? `${linkLabel} (${value.url})` : value.url;
  }
  return undefined;
}

interface RichTextNode {
  type?: string;
  text?: string;
  content?: RichTextNode[];
}

const blockNodes = new Set(["paragraph", "heading", "blockquote", "listItem"]);

/**
 * A rich text document's words, one paragraph (or heading, quote, list item) per line, so
 * a comparison reads like the text rather than its structure.
 */
export function richTextAsPlainText(value: unknown): string {
  if (typeof value !== "object" || value === null) return typeof value === "string" ? value : "";
  const lines: string[] = [];
  let line = "";
  const visit = (node: RichTextNode) => {
    if (typeof node.text === "string") line += node.text;
    if (node.type === "hardBreak") line += "\n";
    const isBlock = node.type !== undefined && blockNodes.has(node.type);
    for (const child of node.content ?? []) {
      if (isBlock && child.type !== undefined && blockNodes.has(child.type) && line) {
        lines.push(line);
        line = "";
      }
      visit(child);
    }
    if (isBlock && line) {
      lines.push(line);
      line = "";
    }
  };
  visit(value as RichTextNode);
  if (line) lines.push(line);
  return lines.join("\n");
}
