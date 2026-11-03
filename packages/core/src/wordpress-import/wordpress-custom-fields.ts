import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import { plainText } from "./wordpress-content.js";
import type { WordPressCustomField } from "./wordpress-import.schema.js";

/**
 * Custom fields (post meta, often made with Advanced Custom Fields) going into the fields
 * of the content type posts and pages go into. WordPress stores every value as text, so
 * each is read the way the receiving field needs: "1" is on for a toggle, "20240302" (ACF's
 * date format) is a date, an attachment id is the image it became, and PHP's serialized
 * lists ("a:2:{i:0;s:3:"red";...}") are lists.
 */

/** The fieldtypes a custom field can go into. */
export const valueFieldTypes = new Set([
  "text",
  "textarea",
  "markdown",
  "code",
  "richText",
  "number",
  "range",
  "toggle",
  "date",
  "time",
  "email",
  "url",
  "link",
  "colour",
  "video",
  "select",
  "radio",
  "buttonGroup",
  "checkboxes",
  "list",
  "image",
]);

interface TargetField {
  handle: string;
}

/** A field with the same handle as the custom field ("hero_colour" for "hero-colour"). */
export function suggestCustomFields(
  customFields: readonly WordPressCustomField[],
  fields: readonly TargetField[] | undefined,
): Record<string, string | null> {
  const handles = new Set((fields ?? []).map((field) => field.handle));
  return Object.fromEntries(
    customFields.map((field) => {
      const handle = field.key.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      return [field.key, handles.has(handle) ? handle : null];
    }),
  );
}

/** Problems with the chosen fields, keyed for the mapping screen; empty when all is well. */
export function customFieldTargets(
  chosen: Record<string, string | null>,
  fields: readonly TargetField[] | undefined,
): Record<string, string> {
  const handles = new Set((fields ?? []).map((field) => field.handle));
  const problems: Record<string, string> = {};
  for (const [key, handle] of Object.entries(chosen)) {
    if (handle !== null && !handles.has(handle)) {
      problems[`customField.${key}`] =
        `“${key}” can't go into “${handle}”: the content type has no such field`;
    }
  }
  return problems;
}

/** What else a value may need: the images brought in so far. */
export interface CustomFieldLookups {
  /** The asset an attachment id became, if it was brought in. */
  attachment(attachmentId: string): string | undefined;
}

/** The value to store, or undefined when the text can't be read as what the field holds. */
export function convertCustomField(
  value: string,
  field: FieldDefinition,
  lookups: CustomFieldLookups,
): unknown {
  const trimmed = value.trim();
  if (trimmed === "") {
    return undefined;
  }
  switch (field.type) {
    case "number":
    case "range": {
      const number = Number(trimmed);
      return Number.isFinite(number) ? number : undefined;
    }
    case "toggle":
      return ["1", "true", "yes", "on"].includes(trimmed.toLowerCase());
    case "date":
      return readDate(trimmed);
    case "image":
      return /^\d+$/.test(trimmed) ? lookups.attachment(trimmed) : undefined;
    case "link":
      return { url: trimmed };
    case "richText":
      return undefined;
    case "checkboxes":
    case "list":
      return readList(trimmed);
    case "select":
      return field.options.multiple === true ? readList(trimmed) : trimmed;
    case "text":
    case "textarea":
      return trimmed.includes("<") ? plainText(trimmed) : trimmed;
    default:
      return trimmed;
  }
}

/** ACF saves dates as 20240302; other plugins write 2024-03-02 or a full date and time. */
function readDate(value: string): string | undefined {
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (compact) {
    return `${compact[1]}-${compact[2]}-${compact[3]}`;
  }
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return iso?.[1];
}

/**
 * A list stored by PHP (`a:2:{i:0;s:3:"red";i:1;s:4:"blue";}`), or comma-separated text.
 * Only lists of plain text and numbers are read; anything else isn't a list here.
 */
export function readList(value: string): string[] | undefined {
  if (/^a:\d+:\{/.test(value)) {
    const items = [...value.matchAll(/i:\d+;(?:s:\d+:"([^"]*)"|i:(-?\d+)|d:([\d.]+));/g)].map(
      (match) => match[1] ?? match[2] ?? match[3] ?? "",
    );
    return items.length > 0 ? items : undefined;
  }
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");
  return items.length > 0 ? items : undefined;
}
