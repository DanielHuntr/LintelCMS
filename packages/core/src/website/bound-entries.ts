import type { BindableField, BoundItem, BoundValue } from "@lintel/builder-model";
import { formatDate } from "@lintel/site-components";
import type { DeliveredEntry } from "../delivery/delivery.schema.js";
import { entryImage, entrySummary, entryTitle, readHtml, readTerms } from "./delivered-to-site.js";

/**
 * Entries as the builder's elements show them: the fields every entry has (title, summary,
 * picture, address, date, body) and each of its own fields under `data.<handle>`, as text, a
 * picture or formatted text. Pure, so the canvas's samples and the website agree.
 */

function boundValue(value: unknown): BoundValue | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const terms = readTerms(value);
    if (terms.length > 0) return terms.map((term) => term.title).join(", ");
    return value.every((item) => typeof item === "string") ? value.join(", ") : undefined;
  }
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if ("html" in record) return { html: readHtml(value) };
  if (typeof record.url === "string" && ("alt" in record || "width" in record)) {
    return {
      src: record.url,
      alt: typeof record.alt === "string" ? record.alt : "",
      width: typeof record.width === "number" ? record.width : null,
      height: typeof record.height === "number" ? record.height : null,
    };
  }
  if (typeof record.url === "string") return record.url;
  return undefined;
}

export function entryAsItem(entry: DeliveredEntry, url: string, locale: string): BoundItem {
  const image = entryImage(entry);
  const fields: Record<string, BoundValue> = {
    title: entryTitle(entry),
    excerpt: entrySummary(entry),
    image: image
      ? { src: image.url, alt: image.alt, width: image.width, height: image.height }
      : null,
    url,
    publishedAt: entry.publishedAt ? formatDate(entry.publishedAt, locale) : "",
    body: { html: readHtml(entry.data.body) },
  };
  for (const [handle, value] of Object.entries(entry.data)) {
    const bound = boundValue(value);
    if (bound !== undefined) fields[`data.${handle}`] = bound;
  }
  return { id: entry.id, fields };
}

const kindOfType: Record<string, BindableField["kind"]> = {
  text: "text",
  textarea: "text",
  email: "text",
  colour: "text",
  number: "text",
  select: "text",
  terms: "text",
  toggle: "text",
  date: "date",
  url: "link",
  link: "link",
  image: "image",
  richText: "html",
  markdown: "html",
};

/** A blueprint's fields as the "Show a field" picker lists them. */
export function bindableFieldsOf(
  fields: ReadonlyArray<{ handle: string; label: string; type: string }>,
): BindableField[] {
  return fields.flatMap((field) => {
    const kind = kindOfType[field.type];
    return kind ? [{ path: `data.${field.handle}`, label: field.label, kind }] : [];
  });
}
