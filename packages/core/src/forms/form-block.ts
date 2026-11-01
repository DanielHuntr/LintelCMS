import { BlueprintNotFoundError } from "../blueprints/blueprints.errors.js";
import { findBlueprintOrFail, updateBlueprint } from "../blueprints/blueprints.service.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";

const PAGE_BLUEPRINT = "page";
const SECTIONS_FIELD = "sections";

function field(handle: string, label: string, type: string, required = false): FieldDefinition {
  return { handle, label, type, required, helpText: "", options: {} };
}

/** The page section that shows a form, offered among Hero, Text and the rest. */
export const formBlockType = {
  handle: "form",
  name: "Form",
  description: "One of your forms, such as a contact form or a newsletter sign-up.",
  fields: [field("heading", "Heading", "text"), field("form", "Form", "form", true)],
};

/**
 * Adds the Form section to pages, when the Forms plugin is switched on. Pages a site has
 * changed keep their own block types; only a missing Form section is added, and switching
 * the plugin off again removes nothing.
 */
export async function ensureFormBlockOnPages(database: DatabaseOrTransaction): Promise<void> {
  let blueprint;
  try {
    blueprint = await findBlueprintOrFail(database, PAGE_BLUEPRINT);
  } catch (error) {
    if (error instanceof BlueprintNotFoundError) return;
    throw error;
  }
  const sections = blueprint.fields.find(
    (candidate) => candidate.handle === SECTIONS_FIELD && candidate.type === "blocks",
  );
  const blockTypes = sections?.options.blockTypes;
  if (!sections || !Array.isArray(blockTypes)) return;
  if (blockTypes.some((type: { handle?: unknown }) => type.handle === formBlockType.handle)) return;

  await updateBlueprint(database, PAGE_BLUEPRINT, {
    name: blueprint.name,
    fields: blueprint.fields.map((candidate) =>
      candidate === sections
        ? {
            ...candidate,
            options: { ...candidate.options, blockTypes: [...blockTypes, formBlockType] },
          }
        : candidate,
    ),
  });
}
