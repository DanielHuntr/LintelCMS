import type { BoundPicture } from "../data/bound-items.js";
import { escapeAttribute } from "../html/html-writer.js";
import { displayValue, isShown, readRows, rowProperties } from "./block-bindings.js";
import type { BlockProperty } from "./custom-block.js";

/**
 * HTML templates for blocks written in code, with a property in each slot:
 *
 *   <article class="team-card">
 *     <img src="{{photo}}" alt="{{photo.alt}}">
 *     <h3>{{name}}</h3>
 *     {{#show_linkedin}}<a href="{{linkedin}}">LinkedIn</a>{{/show_linkedin}}
 *     {{^role}}<p>Part of the team</p>{{/role}}
 *     <ul>{{#skills}}<li>{{label}}</li>{{/skills}}</ul>
 *   </article>
 *
 * - `{{handle}}` is the value, escaped: text, a picture's address, a link's address.
 * - `{{photo.alt}}` is a picture's description; `{{link.label}}` a link's words.
 * - `{{#handle}}…{{/handle}}` is kept while a toggle is on or a value is filled in, and is
 *   repeated for each row of a list, whose fields its slots then name.
 * - `{{^handle}}…{{/handle}}` is kept while it isn't.
 *
 * The template is the developer's (it comes from a file, like code blocks it is trusted);
 * every value put into it is escaped.
 */

type TemplatePart =
  | { kind: "text"; text: string }
  | { kind: "slot"; path: string }
  | { kind: "section"; handle: string; inverted: boolean; parts: TemplatePart[] };

export class BlockTemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockTemplateError";
  }
}

const tagPattern = /\{\{\s*([#^/]?)\s*([A-Za-z][\w.]*)\s*\}\}/g;

/** Reads a template into parts. Throws a `BlockTemplateError` naming an unclosed section. */
export function parseBlockTemplate(template: string): TemplatePart[] {
  const root: TemplatePart[] = [];
  const stack: Array<{ handle: string; parts: TemplatePart[] }> = [{ handle: "", parts: root }];
  let last = 0;
  for (const match of template.matchAll(tagPattern)) {
    const [whole, sigil, name] = match as unknown as [string, string, string];
    const current = stack[stack.length - 1] as { handle: string; parts: TemplatePart[] };
    if (match.index > last)
      current.parts.push({ kind: "text", text: template.slice(last, match.index) });
    last = match.index + whole.length;
    if (sigil === "#" || sigil === "^") {
      const section: TemplatePart = {
        kind: "section",
        handle: name,
        inverted: sigil === "^",
        parts: [],
      };
      current.parts.push(section);
      stack.push({ handle: name, parts: section.parts });
    } else if (sigil === "/") {
      if (current.handle !== name) {
        throw new BlockTemplateError(
          current.handle
            ? `The template closes {{/${name}}} where it should close {{/${current.handle}}}`
            : `The template closes {{/${name}}}, which it never opened`,
        );
      }
      stack.pop();
    } else {
      current.parts.push({ kind: "slot", path: name });
    }
  }
  const open = stack[stack.length - 1];
  if (stack.length > 1 && open) {
    throw new BlockTemplateError(`The template opens {{#${open.handle}}} but never closes it`);
  }
  if (last < template.length) root.push({ kind: "text", text: template.slice(last) });
  return root;
}

/** The property handles a template's slots and sections name at the top level. */
export function templateSlots(template: string): string[] {
  const handles = new Set<string>();
  for (const part of parseBlockTemplate(template)) {
    if (part.kind === "slot") handles.add(part.path.split(".")[0] as string);
    if (part.kind === "section") handles.add(part.handle);
  }
  return [...handles];
}

/** The template with the values in its slots. */
export function fillBlockTemplate(
  template: string,
  values: Readonly<Record<string, unknown>>,
  properties: readonly BlockProperty[],
  pictures: Readonly<Record<string, BoundPicture>> = {},
): string {
  return fillParts(parseBlockTemplate(template), values, properties, pictures);
}

function fillParts(
  parts: readonly TemplatePart[],
  values: Readonly<Record<string, unknown>>,
  properties: readonly BlockProperty[],
  pictures: Readonly<Record<string, BoundPicture>>,
): string {
  const find = (handle: string) => properties.find((property) => property.handle === handle);
  return parts
    .map((part) => {
      if (part.kind === "text") return part.text;
      if (part.kind === "slot") return escapeAttribute(slotText(part.path, values, find, pictures));
      const property = find(part.handle);
      const value = values[part.handle];
      if (property?.type === "repeater" && !part.inverted) {
        return readRows(value)
          .map((row) => fillParts(part.parts, row.data, rowProperties(property), pictures))
          .join("");
      }
      const shown = isShown(value, property);
      return shown !== part.inverted ? fillParts(part.parts, values, properties, pictures) : "";
    })
    .join("");
}

function slotText(
  path: string,
  values: Readonly<Record<string, unknown>>,
  find: (handle: string) => BlockProperty | undefined,
  pictures: Readonly<Record<string, BoundPicture>>,
): string {
  const [handle = "", detail] = path.split(".");
  const property = find(handle);
  const value = values[handle];
  if (!property) return "";
  if (property.type === "image" && typeof value === "string") {
    const picture = pictures[value];
    return detail === "alt" ? (picture?.alt ?? "") : (picture?.src ?? "");
  }
  if (property.type === "link" && detail === "label" && typeof value === "object" && value) {
    const label = (value as { label?: unknown }).label;
    return typeof label === "string" ? label : "";
  }
  const shown = displayValue(value, property, pictures);
  return typeof shown === "string" ? shown : "";
}
