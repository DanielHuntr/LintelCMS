import { randomUUID } from "node:crypto";
import MarkdownIt from "markdown-it";
import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import { plainText, splitWordPressContent } from "../wordpress-import/wordpress-content.js";
import { piecesToRichText } from "../wordpress-import/wordpress-rich-text.js";
import type { DesignValue, SourceFieldKind, SourceValue } from "./source-site.js";

/**
 * Turns a value from another system into what the receiving field stores. Values that
 * can't be read as what the field holds give undefined, and the entry is saved without
 * them (the report lists them), so one odd value never loses a whole page.
 *
 * Rich text arrives as HTML (Webflow, Umbraco, Statamic's Bard turned to HTML) or Markdown
 * (Statamic); both go through the same conversion as WordPress content, so what rich text
 * can't hold is kept as an HTML block rather than lost.
 */
export interface ValueLookups {
  /** The asset a picture's media key became. */
  asset(mediaKey: string): string | undefined;
  /** The term a term key became. */
  term(termKey: string): string | undefined;
  /** The entry an entry key became, if it has come in yet. */
  entry(entryKey: string): string | undefined;
  /** A picture's address in the media library, for pictures inside rich text, by its old address. */
  pictureAddress(oldAddress: string): string | null;
}

const markdown = new MarkdownIt({ html: true, linkify: true });

export interface ConvertedValue {
  value: unknown;
  /** Pieces of rich text kept as HTML blocks, for the report. */
  keptAsHtml?: string[];
}

export function convertValue(
  value: SourceValue,
  kind: SourceFieldKind,
  field: Pick<FieldDefinition, "type" | "options">,
  lookups: ValueLookups,
): ConvertedValue | undefined {
  if (value === null || value === "") {
    return undefined;
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return undefined;
  }
  const list = Array.isArray(value) ? value : [String(value)];
  const text = Array.isArray(value) ? value.join(", ") : String(value).trim();

  switch (field.type) {
    case "richText": {
      const html = kind === "markdown" ? markdown.render(text) : textAsHtml(text);
      const converted = piecesToRichText(splitWordPressContent(html), lookups.pictureAddress);
      return { value: converted.document, keptAsHtml: converted.keptAsHtml };
    }
    case "markdown":
    case "textarea":
    case "code":
      return { value: kind === "richText" && field.type !== "code" ? plainText(text) : text };
    case "text":
    case "slug":
      return { value: plainText(text).slice(0, 2000) };
    case "number":
    case "range": {
      const number = typeof value === "number" ? value : Number(text);
      return Number.isFinite(number) ? { value: number } : undefined;
    }
    case "toggle":
      return {
        value: typeof value === "boolean" ? value : ["1", "true", "yes", "on"].includes(text),
      };
    case "date": {
      const date = /^(\d{4}-\d{2}-\d{2})/.exec(text)?.[1] ?? isoDate(text);
      return date ? { value: date } : undefined;
    }
    case "image": {
      const assetId = list.map((key) => lookups.asset(key)).find(Boolean);
      return assetId ? { value: assetId } : undefined;
    }
    case "repeater": {
      const rows = list
        .flatMap((key) => lookups.asset(key) ?? [])
        .map((assetId) => ({ id: randomUUID(), data: { picture: assetId } }));
      return rows.length > 0 ? { value: rows } : undefined;
    }
    case "link":
      return { value: { url: text } };
    case "colour":
      return /^#?[0-9a-f]{6}$/i.test(text)
        ? { value: `#${text.replace(/^#/, "").toLowerCase()}` }
        : undefined;
    case "terms": {
      const ids = list.flatMap((key) => lookups.term(key) ?? []);
      return ids.length > 0 ? { value: [...new Set(ids)] } : undefined;
    }
    case "entries": {
      const ids = list.flatMap((key) => lookups.entry(key) ?? []);
      return ids.length > 0 ? { value: [...new Set(ids)] } : undefined;
    }
    case "list":
    case "checkboxes":
      return { value: list.map((item) => item.trim()).filter(Boolean) };
    case "select":
      return { value: field.options.multiple === true ? list : (list[0] ?? text) };
    default:
      return { value: text };
  }
}

/** Plain text (a Webflow plain text field going into rich text) as paragraphs. */
function textAsHtml(text: string): string {
  if (/<[a-z][\s\S]*>/i.test(text)) {
    return text;
  }
  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function isoDate(text: string): string | undefined {
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
}

export function isDesignValue(value: SourceValue | undefined): value is DesignValue {
  return typeof value === "object" && value !== null && !Array.isArray(value) && "html" in value;
}
