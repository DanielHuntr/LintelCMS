import type { BlockComponent } from "@lintel/builder/render";
import type { FieldSpec } from "../content-model-sync/field-helpers.js";

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
