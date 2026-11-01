import { stringify } from "yaml";
import type { ModelUnit } from "./content-model.schema.js";
import { definitionFromUnit } from "./model-to-definitions.js";

/**
 * Writes a unit as a YAML file. The first line points VS Code's YAML extension at the
 * JSON Schema next to the folder (lintel.schema.json), so it completes and checks keys.
 */

export const JSON_SCHEMA_FILE_NAME = "lintel.schema.json";

/** `relativeSchemaPath` is the schema's path from the file, such as `../lintel.schema.json`. */
export function printYamlFile(unit: ModelUnit, relativeSchemaPath: string, header = ""): string {
  const modeline = `# yaml-language-server: $schema=${relativeSchemaPath}\n`;
  // lineWidth 0 keeps long help texts on one line instead of folding them.
  return `${modeline}${header}${stringify(definitionFromUnit(unit), { lineWidth: 0 })}`;
}

/** Comment lines at the top of an existing file, without the modeline, which is rewritten. */
export function yamlHeader(source: string): string {
  const lines = [];
  for (const line of source.split("\n")) {
    if (!line.trim().startsWith("#")) {
      break;
    }
    if (!line.includes("yaml-language-server:")) {
      lines.push(line);
    }
  }
  return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
}
