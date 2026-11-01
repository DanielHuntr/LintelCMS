import {
  type BlockProperty,
  BlockTemplateError,
  blockHandlePattern,
  type CustomBlock,
  parseBlockTemplate,
  templateSlots,
} from "@lintel/builder-model";
import type { BlockComponent } from "@lintel/builder/render";
import { checkFieldDefinitions } from "../blueprints/blueprint-fields.js";
import type { FieldSpec } from "../content-model-sync/field-helpers.js";
import { fieldsFromSpecs } from "../content-model-sync/model-from-definitions.js";
import { InvalidFieldsError } from "../http/http-errors.js";

/**
 * Blocks written in code: a file in `content-model/blocks/` or a plugin's `blocks`.
 *
 *   // content-model/blocks/team_card.block.ts
 *   import { defineBlock, image, text, toggle, url } from "@lintel/core/content-model";
 *
 *   export default defineBlock({
 *     name: "Team card",
 *     icon: "users",
 *     category: "Team",
 *     properties: { name: text({ required: true }), photo: image(), role: text(),
 *                   show_linkedin: toggle({ default: true }), linkedin: url() },
 *     render: `<article class="team-card">...{{name}}...</article>`,
 *   });
 *
 * `render` is an HTML template with property slots (see block-template.ts in the page
 * model), or a React component the server draws with `{ properties }`. Properties use the
 * same helpers as content types, so they have the same types and settings.
 */
export interface BlockInput<Properties = Record<string, unknown>> {
  /** Lowercase letters, numbers and underscores. A file's name gives it when left out. */
  handle?: string;
  /** What editors see in Insert, such as "Team card". */
  name: string;
  /** An icon from the site's icon set, such as "users". */
  icon?: string;
  /** Blocks with the same group are listed together in Insert. */
  category?: string;
  /** One plain sentence for Insert. */
  description?: string;
  /** The properties, keyed by handle, in the order editors see them. */
  properties?: Record<string, FieldSpec>;
  render: string | BlockComponent<Properties>;
}

export interface BlockDefinition<
  Properties = Record<string, unknown>,
> extends BlockInput<Properties> {
  kind: "block";
}

/** One of the site's blocks, written in code. Type `properties` with `model types`' output. */
export function defineBlock<Properties = Record<string, unknown>>(
  input: BlockInput<Properties>,
): BlockDefinition<Properties> {
  return { kind: "block", ...input };
}

/** What can't be a block's property: fields that hold pages or other blocks, and tabs. */
const notProperties = new Set(["blocks", "page", "tab", "fieldset"]);

/**
 * A definition as the block the builder and the server use, checked with a blueprint's
 * rules. Throws `InvalidFieldsError` with every problem, keyed by property (or `render`).
 */
export function blockFromDefinition(
  definition: BlockDefinition<never> | BlockDefinition,
  handle: string,
  source: "code" | "plugin",
): CustomBlock {
  const problems: Record<string, string> = {};
  if (!blockHandlePattern.test(handle)) {
    problems.handle = "A block's handle uses lowercase letters, numbers and underscores";
  }
  if (typeof definition.name !== "string" || definition.name.trim() === "") {
    problems.name = "A block needs a name";
  }
  const rawProperties = fieldsFromSpecs(definition.properties ?? {});
  let properties: BlockProperty[] = [];
  try {
    properties = checkProperties(rawProperties);
  } catch (error) {
    if (!(error instanceof InvalidFieldsError)) throw error;
    Object.assign(problems, error.fields);
  }
  const template = typeof definition.render === "string" ? definition.render : null;
  if (template !== null) {
    const problem = templateProblem(template, properties);
    if (problem) problems.render = problem;
  } else if (typeof definition.render !== "function") {
    problems.render = "render should be an HTML template or a React component";
  }
  if (Object.keys(problems).length > 0) throw new InvalidFieldsError(problems);
  return {
    handle,
    name: definition.name.trim(),
    icon: definition.icon ?? "square",
    category: definition.category ?? "",
    description: definition.description ?? "",
    source,
    properties,
    design: null,
    template,
    renamedProperties: {},
  };
}

/** Properties are fields with a blueprint's rules, except the kinds that can't be properties. */
export function checkProperties(rawProperties: readonly unknown[]): BlockProperty[] {
  const refused: Record<string, string> = {};
  rawProperties.forEach((candidate, index) => {
    const { type, handle } = (candidate ?? {}) as { type?: unknown; handle?: unknown };
    if (typeof type === "string" && notProperties.has(type)) {
      refused[typeof handle === "string" ? handle : `property ${index + 1}`] =
        "A block's property can't be a page design, a blocks field, a fieldset or a tab";
    }
  });
  if (Object.keys(refused).length > 0) throw new InvalidFieldsError(refused);
  return checkFieldDefinitions(rawProperties) as BlockProperty[];
}

function templateProblem(template: string, properties: readonly BlockProperty[]): string | null {
  try {
    parseBlockTemplate(template);
  } catch (error) {
    if (error instanceof BlockTemplateError) return error.message;
    throw error;
  }
  const known = new Set(properties.map((property) => property.handle));
  const unknown = templateSlots(template).filter((slot) => !known.has(slot));
  return unknown.length > 0
    ? `The template uses ${unknown.map((slot) => `{{${slot}}}`).join(", ")}, which ${unknown.length === 1 ? "isn't a property" : "aren't properties"}`
    : null;
}

/**
 * React blocks' components, by handle: code blocks' are registered when their files are
 * read, plugins' when the server starts. Templates need nothing here; they are stored.
 */
const blockComponents = new Map<string, BlockComponent>();

export function registerBlockComponent(handle: string, component: BlockComponent): void {
  blockComponents.set(handle, component);
}

export function findBlockComponent(handle: string): BlockComponent | undefined {
  return blockComponents.get(handle);
}

/** Plugins' blocks, offered while their plugin is switched on. */
const pluginBlocks = new Map<string, { pluginId: string; block: CustomBlock }>();

/**
 * Registers a plugin's blocks. Each handle must start with the plugin's id (dashes as
 * underscores) and an underscore: `bookings_slot_picker`.
 */
export function registerPluginBlocks(
  pluginId: string,
  definitions: readonly BlockDefinition<never>[] | readonly BlockDefinition[],
): void {
  for (const definition of definitions) {
    const handle = definition.handle ?? "";
    const block = blockFromDefinition(definition, handle, "plugin");
    pluginBlocks.set(handle, { pluginId, block });
    if (typeof definition.render === "function") {
      registerBlockComponent(handle, definition.render as BlockComponent);
    }
  }
}

/** The prefix a plugin's block handles start with. */
export function pluginBlockPrefix(pluginId: string): string {
  return `${pluginId.replace(/-/g, "_")}_`;
}

export function listPluginBlocks(enabledPlugins: readonly string[]): CustomBlock[] {
  return [...pluginBlocks.values()]
    .filter(({ pluginId }) => enabledPlugins.includes(pluginId))
    .map(({ block }) => block);
}
