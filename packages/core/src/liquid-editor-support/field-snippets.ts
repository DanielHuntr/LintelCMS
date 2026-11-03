import { type ContentModel, sortedUnits } from "../content-model-sync/content-model.schema.js";
import { findFieldtype } from "../fieldtypes/fieldtypes.registry.js";
import { type EditorSnippet, type EditorSnippets, SNIPPET_SCOPE } from "./tag-snippets.js";

/**
 * VS Code snippets for the site's own fields, made from the content model: typing
 * `entry.data.` in a template suggests each content type's fields, with the field's label
 * and type in the description. Pictures come wrapped in `{% image %}`, rich text with
 * `| rich_text`, lists in a `for` loop, and the fields of groups and fieldsets as
 * `entry.data.group.field`.
 */

/** A field as the content model holds it; only what the snippets need. */
interface SnippetField {
  handle: string;
  label: string;
  type: string;
  required: boolean;
  options: Record<string, unknown>;
}

/** Fieldtypes whose value is a list, so a template loops over it. */
const LIST_TYPES = new Set([
  "entries",
  "terms",
  "users",
  "repeater",
  "blocks",
  "list",
  "checkboxes",
]);

/** Fieldtypes whose value is an object of other fields: `entry.data.seo.meta_title`. */
const GROUP_TYPES = new Set(["group", "fieldset"]);

export function fieldSnippetsForModel(model: ContentModel): EditorSnippets {
  const snippets: EditorSnippets = {};
  for (const unit of sortedUnits(model)) {
    if (unit.kind !== "contentType") continue;
    const owner = { handle: unit.handle, name: unit.name };
    for (const [path, field] of valueFields(unit.fields, [])) {
      snippets[`Lintel: ${unit.handle}.${path}`] = fieldSnippet(owner, path, field);
    }
  }
  return snippets;
}

/** Every field that holds a value, by its path from `entry.data`, groups opened up. */
function valueFields(fields: readonly SnippetField[], parents: string[]): [string, SnippetField][] {
  return fields.flatMap((field): [string, SnippetField][] => {
    if (findFieldtype(field.type)?.holdsValue === false) return [];
    const path = [...parents, field.handle];
    if (GROUP_TYPES.has(field.type)) {
      return valueFields(innerFields(field), path);
    }
    return [[path.join("."), field]];
  });
}

function innerFields(field: SnippetField): SnippetField[] {
  const fields = field.options.fields;
  return Array.isArray(fields) ? fields.filter(isSnippetField) : [];
}

function isSnippetField(value: unknown): value is SnippetField {
  if (typeof value !== "object" || value === null) return false;
  const field = value as Record<string, unknown>;
  return typeof field.handle === "string" && typeof field.type === "string";
}

function fieldSnippet(
  owner: { handle: string; name: string },
  path: string,
  field: SnippetField,
): EditorSnippet {
  const value = `entry.data.${path}`;
  const typeName = findFieldtype(field.type)?.name ?? field.type;
  // Fields inside groups are read loosely from their options, so the label may be missing.
  const label = typeof field.label === "string" && field.label !== "" ? field.label : path;
  return {
    scope: SNIPPET_SCOPE,
    prefix: [value, `${owner.handle}.${path}`],
    body: fieldBody(value, field.type),
    description:
      `${label}: ${typeName.toLowerCase()} field of ${owner.name}` +
      (field.required === true ? " (required)" : ""),
  };
}

function fieldBody(value: string, type: string): string[] {
  if (type === "image") return [`{% image ${value} width: \${1:800} %}$0`];
  if (type === "richText" || type === "markdown") return [`{{ ${value} | rich_text }}$0`];
  if (type === "date") return [`{{ ${value} | date: "\${1:%-d %B %Y}" }}$0`];
  if (type === "toggle") return [`{% if ${value} %}`, "\t$0", "{% endif %}"];
  if (LIST_TYPES.has(type)) {
    return [`{% for \${1:item} in ${value} %}`, "\t$0", "{% endfor %}"];
  }
  return [`{{ ${value} }}$0`];
}
