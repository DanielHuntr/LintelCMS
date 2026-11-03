import { isReadableRichText, renderRichTextHtml } from "../../fieldtypes/rich-text.js";
import type { SourceField, SourceFieldKind, SourceValue } from "../source-site.js";

/**
 * Statamic blueprints' fieldtypes and the kinds they become, and reading their values.
 * Fieldtypes with no equal here (replicator, grid, table, yaml...) are left out and named
 * in the report.
 */
const kinds: Record<string, SourceFieldKind> = {
  text: "text",
  textarea: "textarea",
  markdown: "markdown",
  bard: "richText",
  redactor: "richText",
  assets: "image",
  date: "date",
  toggle: "toggle",
  integer: "number",
  float: "number",
  range: "number",
  select: "select",
  radio: "select",
  button_group: "select",
  checkboxes: "select",
  terms: "terms",
  taxonomy: "terms",
  entries: "entries",
  link: "url",
  code: "code",
  color: "colour",
  list: "list",
  video: "video",
};

/** Fields every entry has in its own right, not as a field. */
const ownFields = new Set(["title", "slug", "date", "published", "id", "blueprint", "parent"]);

export interface StatamicFieldConfig {
  handle: string;
  field: Record<string, unknown>;
}

export interface ReadFields {
  fields: SourceField[];
  /** Fields left out, as "handle (type)". */
  leftOut: string[];
}

/** Every field in a blueprint, whichever layout it has (tabs, sections, or a plain list). */
export function blueprintFieldConfigs(blueprint: unknown): StatamicFieldConfig[] {
  const found: StatamicFieldConfig[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!isRecord(value)) return;
    if (typeof value.handle === "string" && isRecord(value.field)) {
      found.push({ handle: value.handle, field: value.field });
      return;
    }
    for (const key of ["tabs", "sections", "fields"]) {
      const inner = value[key];
      if (isRecord(inner)) Object.values(inner).forEach(visit);
      else visit(inner);
    }
  };
  visit(blueprint);
  return found;
}

export function readStatamicFields(
  configs: readonly StatamicFieldConfig[],
  taxonomyKeys: ReadonlySet<string>,
): ReadFields {
  const fields: SourceField[] = [];
  const leftOut: string[] = [];
  for (const { handle, field } of configs) {
    if (ownFields.has(handle)) continue;
    const type = typeof field.type === "string" ? field.type : "text";
    const kind = kinds[type];
    if (!kind) {
      leftOut.push(`${handle} (${type})`);
      continue;
    }
    const label = typeof field.display === "string" ? field.display : handle;
    const source: SourceField = { key: handle, label, kind };
    if (kind === "image" && field.max_files !== 1) source.kind = "images";
    if (kind === "select") {
      const options = field.options;
      source.choices = Array.isArray(options)
        ? options.map(String)
        : isRecord(options)
          ? Object.keys(options)
          : [];
      source.multiple = type === "checkboxes" || field.multiple === true;
    }
    if (kind === "terms") {
      const taxonomies = asStrings(field.taxonomies ?? field.taxonomy);
      const taxonomyKey = taxonomies.find((key) => taxonomyKeys.has(key));
      if (!taxonomyKey) {
        leftOut.push(`${handle} (terms from a taxonomy that isn't in the zip)`);
        continue;
      }
      source.taxonomyKey = taxonomyKey;
    }
    if (kind === "entries") source.typeKeys = asStrings(field.collections);
    fields.push(source);
  }
  return { fields, leftOut };
}

/** Fields worked out from entries' values, for collections without a blueprint in the zip. */
export function fieldsFromValues(entries: ReadonlyArray<Record<string, unknown>>): SourceField[] {
  const keys = new Set<string>();
  for (const data of entries) {
    for (const key of Object.keys(data))
      if (!ownFields.has(key) && !key.startsWith("updated_")) keys.add(key);
  }
  return [...keys].map((key) => ({
    key,
    label: key.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase()),
    kind: key === "content" ? "markdown" : "text",
  }));
}

/**
 * A stored value as the importer's own kind of value. `term` and `asset` turn Statamic's
 * references (a term's slug, an asset's path) into the import's keys.
 */
export function readStatamicValue(
  value: unknown,
  field: SourceField,
  refer: { term(taxonomyKey: string, slug: string): string; asset(path: string): string | null },
): SourceValue {
  if (value === null || value === undefined) return null;
  switch (field.kind) {
    case "richText":
      return Array.isArray(value) ? bardToHtml(value) : String(value);
    case "image":
    case "images": {
      const keys = asStrings(value).flatMap((path) => refer.asset(path) ?? []);
      return field.kind === "image" ? (keys[0] ?? null) : keys;
    }
    case "terms":
      return asStrings(value).map((slug) => refer.term(field.taxonomyKey ?? "", slug));
    case "entries":
    case "list":
      return asStrings(value);
    case "select":
      return Array.isArray(value) ? asStrings(value) : String(value);
    case "toggle":
      return value === true || value === "true";
    case "number":
      return typeof value === "number" ? value : Number(value);
    case "url":
      return typeof value === "string" ? value : null;
    default:
      return typeof value === "object" ? JSON.stringify(value) : String(value);
  }
}

/**
 * Bard stores ProseMirror nodes, much like Lintel's own rich text. Its "sets" (blocks of
 * other fields inside the text) have no equal, so they're left out.
 */
export function bardToHtml(nodes: unknown[]): string {
  const document = {
    type: "doc" as const,
    content: nodes.filter((node) => isRecord(node) && node.type !== "set") as Array<
      Record<string, unknown>
    >,
  };
  if (isReadableRichText(document)) return renderRichTextHtml(document);
  return document.content.map((node) => `<p>${escapeText(collectText(node))}</p>`).join("");
}

function collectText(node: unknown): string {
  if (!isRecord(node)) return "";
  if (typeof node.text === "string") return node.text;
  return Array.isArray(node.content) ? node.content.map(collectText).join("") : "";
}

function escapeText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function asStrings(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item) => item !== null).map(String);
  if (value === null || value === undefined || value === "") return [];
  return [String(value)];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
