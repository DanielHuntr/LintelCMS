/**
 * A form for an add-on's settings, read from their JSON Schema (which the server writes
 * from the add-on's Zod schema). Only simple settings get one: text, numbers, on/off and a
 * choice from a list, one level deep. Anything else means the add-on brings its own screen.
 */

export type SettingsFormField =
  | { kind: "text"; key: string; label: string; maxLength: number | undefined }
  | {
      kind: "number";
      key: string;
      label: string;
      minimum: number | undefined;
      maximum: number | undefined;
      whole: boolean;
    }
  | { kind: "toggle"; key: string; label: string }
  | { kind: "choice"; key: string; label: string; options: string[] };

/** The fields, in the schema's order, or null when the settings are too involved for one. */
export function readSettingsForm(
  schema: Record<string, unknown> | null,
): SettingsFormField[] | null {
  if (!schema || schema.type !== "object" || !isRecord(schema.properties)) return null;
  const fields: SettingsFormField[] = [];
  for (const [key, property] of Object.entries(schema.properties)) {
    const field = readField(key, property);
    if (!field) return null;
    fields.push(field);
  }
  return fields.length > 0 ? fields : null;
}

function readField(key: string, property: unknown): SettingsFormField | null {
  if (!isRecord(property)) return null;
  const label = typeof property.title === "string" ? property.title : labelFromKey(key);
  if (Array.isArray(property.enum) && property.enum.every((option) => typeof option === "string")) {
    return { kind: "choice", key, label, options: property.enum };
  }
  switch (property.type) {
    case "string":
      return { kind: "text", key, label, maxLength: numberOrUndefined(property.maxLength) };
    case "number":
    case "integer":
      return {
        kind: "number",
        key,
        label,
        minimum: numberOrUndefined(property.minimum),
        maximum: numberOrUndefined(property.maximum),
        whole: property.type === "integer",
      };
    case "boolean":
      return { kind: "toggle", key, label };
    default:
      return null;
  }
}

/** "defaultDurationMinutes" → "Default duration minutes"; "show_closed" → "Show closed". */
export function labelFromKey(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
