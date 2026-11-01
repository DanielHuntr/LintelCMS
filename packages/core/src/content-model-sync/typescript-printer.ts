import type { ModelUnit } from "./content-model.schema.js";
import type { ModelDefinition } from "./define-content-model.js";
import { definitionFromUnit } from "./model-to-definitions.js";

/**
 * Writes a unit of the content model as a TypeScript file, always the same way for the
 * same unit: keys in a fixed order, double quotes, trailing commas, and lines broken only
 * when they would be longer than 100 characters. That is how Prettier would lay it out
 * with this repository's settings, so formatting the folder changes nothing.
 */

const PRINT_WIDTH = 100;
const INDENT = "  ";
export const CONTENT_MODEL_IMPORT = "@lintel/core/content-model";

type Printable = string | number | boolean | null | Printable[] | PrintableObject | Call;
interface PrintableObject {
  [key: string]: Printable;
}

/** `text({ maxLength: 80 })`: a helper called with one object, or nothing. */
class Call {
  constructor(
    readonly callee: string,
    readonly argument: PrintableObject | undefined,
  ) {}
}

const DEFINE_FUNCTION: Record<ModelDefinition["kind"], string> = {
  contentType: "defineContentType",
  taxonomy: "defineTaxonomy",
  globalSet: "defineGlobalSet",
  fieldset: "defineFieldset",
  menu: "defineMenu",
};

/** The file's text. `header` is kept from the existing file: comments above the import. */
export function printTypeScriptFile(unit: ModelUnit, header = ""): string {
  const { kind, ...definition } = definitionFromUnit(unit);
  const helpers = new Set<string>([DEFINE_FUNCTION[kind]]);
  const argument = toPrintable(definition, helpers) as PrintableObject;
  const body = `export default ${print(new Call(DEFINE_FUNCTION[kind], argument), 0, 15, 1)};\n`;
  return `${header}${printImport([...helpers].sort())}\n\n${body}`;
}

function printImport(names: string[]): string {
  const flat = `import { ${names.join(", ")} } from "${CONTENT_MODEL_IMPORT}";`;
  if (flat.length <= PRINT_WIDTH) {
    return flat;
  }
  return `import {\n${names.map((name) => `${INDENT}${name},`).join("\n")}\n} from "${CONTENT_MODEL_IMPORT}";`;
}

/** Field specs (objects with a `type`) inside `fields` become helper calls. */
function toPrintable(value: unknown, helpers: Set<string>, parentKey = ""): Printable {
  if (Array.isArray(value)) {
    return value.map((item) => toPrintable(item, helpers));
  }
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value).filter(([, inner]) => inner !== undefined);
    if (parentKey === "fields") {
      return Object.fromEntries(
        entries.map(([handle, spec]) => [
          handle,
          fieldCall(spec as Record<string, unknown>, helpers),
        ]),
      );
    }
    return Object.fromEntries(
      entries.map(([key, inner]) => [key, toPrintable(inner, helpers, key)]),
    );
  }
  return value as Printable;
}

function fieldCall(spec: Record<string, unknown>, helpers: Set<string>): Call {
  const { type, ...options } = spec;
  const helper = String(type);
  helpers.add(helper);
  const argument = toPrintable(options, helpers) as PrintableObject;
  return new Call(helper, Object.keys(argument).length === 0 ? undefined : argument);
}

/**
 * `used` is how many characters are already on the line before the value, `trailing` how
 * many follow it (a comma, a bracket), so the fit is judged on the whole line.
 */
function print(value: Printable, depth: number, used: number, trailing: number): string {
  const flat = printFlat(value);
  if (used + flat.length + trailing <= PRINT_WIDTH || !canBreak(value)) {
    return flat;
  }
  const indent = INDENT.repeat(depth);
  const inner = INDENT.repeat(depth + 1);
  if (value instanceof Call) {
    const opening = `${value.callee}(`;
    return `${opening}${print(value.argument ?? {}, depth, used + opening.length, trailing + 1)})`;
  }
  if (Array.isArray(value)) {
    const items = value.map((item) => `${inner}${print(item, depth + 1, inner.length, 1)},`);
    return `[\n${items.join("\n")}\n${indent}]`;
  }
  const entries = Object.entries(value as PrintableObject).map(([key, entryValue]) => {
    const prefix = `${inner}${printKey(key)}: `;
    return `${prefix}${print(entryValue, depth + 1, prefix.length, 1)},`;
  });
  return `{\n${entries.join("\n")}\n${indent}}`;
}

function canBreak(value: Printable): boolean {
  if (value instanceof Call) {
    return value.argument !== undefined;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return typeof value === "object" && value !== null && Object.keys(value).length > 0;
}

function printFlat(value: Printable): string {
  if (value instanceof Call) {
    return `${value.callee}(${value.argument ? printFlat(value.argument) : ""})`;
  }
  if (Array.isArray(value)) {
    return `[${value.map(printFlat).join(", ")}]`;
  }
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value).map(
      ([key, inner]) => `${printKey(key)}: ${printFlat(inner)}`,
    );
    return entries.length === 0 ? "{}" : `{ ${entries.join(", ")} }`;
  }
  return typeof value === "string" ? JSON.stringify(value) : String(value);
}

function printKey(key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
}

/**
 * The comments at the top of an existing file, above its first import, so a note someone
 * wrote there survives the file being rewritten from the admin.
 */
export function typeScriptHeader(source: string): string {
  const lines = source.split("\n");
  const firstCode = lines.findIndex((line) => {
    const trimmed = line.trim();
    return !(
      trimmed === "" ||
      trimmed.startsWith("//") ||
      trimmed.startsWith("/*") ||
      trimmed.startsWith("*")
    );
  });
  const header = lines
    .slice(0, firstCode === -1 ? 0 : firstCode)
    .join("\n")
    .trim();
  return header === "" ? "" : `${header}\n`;
}
