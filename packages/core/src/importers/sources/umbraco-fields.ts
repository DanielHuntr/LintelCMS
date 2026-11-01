import type { SourceField, SourceFieldKind, SourceValue } from "../source-site.js";

/**
 * Umbraco's property editors and the kinds they become, and reading their stored values.
 * Block List, Block Grid, Nested Content and the old Grid hold structured blocks with no
 * equal here, so properties using them are left out and named in the report.
 */
const kinds: Record<string, SourceFieldKind> = {
  "Umbraco.TextBox": "text",
  "Umbraco.TextArea": "textarea",
  "Umbraco.RichText": "richText",
  "Umbraco.TinyMCE": "richText",
  "Umbraco.MarkdownEditor": "markdown",
  "Umbraco.Integer": "number",
  "Umbraco.Decimal": "number",
  "Umbraco.Slider": "number",
  "Umbraco.TrueFalse": "toggle",
  "Umbraco.DateTime": "date",
  "Umbraco.MediaPicker3": "image",
  "Umbraco.MediaPicker": "image",
  "Umbraco.MediaPicker2": "image",
  "Umbraco.ImageCropper": "image",
  "Umbraco.ContentPicker": "entries",
  "Umbraco.MultiNodeTreePicker": "entries",
  "Umbraco.EmailAddress": "email",
  "Umbraco.ColorPicker": "colour",
  "Umbraco.Tags": "list",
  "Umbraco.MultipleTextstring": "list",
  "Umbraco.DropDown.Flexible": "select",
  "Umbraco.RadioButtonList": "select",
  "Umbraco.CheckBoxList": "select",
  "Umbraco.MultiUrlPicker": "url",
};

export function umbracoKind(editor: string): SourceFieldKind | null {
  return kinds[editor] ?? null;
}

/** A GUID with or without dashes, in one form, so references can be matched. */
export function normaliseKey(key: string): string {
  return key.replace(/-/g, "").toLowerCase();
}

/**
 * Media pickers store `[{"mediaKey":"..."}]` (Umbraco 8 and later) or `umb://media/<key>`;
 * content pickers `umb://document/<key>`; tags and lists a JSON array; URL pickers
 * `[{"url": "..."}]`.
 */
export function readUmbracoValue(
  raw: string,
  field: SourceField,
  media: (mediaKey: string) => string | null,
): SourceValue {
  const value = raw.trim();
  if (!value) return null;
  switch (field.kind) {
    case "image": {
      const keys = [
        ...[...value.matchAll(/"mediaKey"\s*:\s*"([0-9a-f-]+)"/gi)].map((match) => match[1] ?? ""),
        ...[...value.matchAll(/umb:\/\/media\/([0-9a-f]+)/gi)].map((match) => match[1] ?? ""),
      ].flatMap((key) => media(normaliseKey(key)) ?? []);
      return keys[0] ?? null;
    }
    case "entries":
      return [...value.matchAll(/umb:\/\/document\/([0-9a-f]+)/gi)].map((match) =>
        normaliseKey(match[1] ?? ""),
      );
    case "list":
    case "select": {
      const parsed = parseJson(value);
      if (Array.isArray(parsed)) return parsed.map(String);
      return field.kind === "list" ? value.split(",").map((item) => item.trim()) : value;
    }
    case "url": {
      const parsed = parseJson(value);
      const first = Array.isArray(parsed) ? (parsed[0] as { url?: unknown } | undefined) : null;
      return typeof first?.url === "string" ? first.url : /^https?:\/\//.test(value) ? value : null;
    }
    case "toggle":
      return value === "1" || value.toLowerCase() === "true";
    case "number":
      return Number(value);
    default:
      return value;
  }
}

/** The file a media item points at: `{"src": "/media/x/loaf.png"}` or the path itself. */
export function umbracoFilePath(raw: string): string | null {
  const parsed = parseJson(raw.trim());
  if (parsed && typeof parsed === "object" && "src" in parsed) {
    const src = (parsed as { src?: unknown }).src;
    return typeof src === "string" && src ? src : null;
  }
  return raw.trim().startsWith("/") ? raw.trim() : null;
}

function parseJson(text: string): unknown {
  if (!/^[[{]/.test(text)) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
