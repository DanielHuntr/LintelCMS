import { z } from "zod";
import { defineComponent } from "../components/component-definition.js";
import type { PageNode } from "../document/page-document.schema.js";

/**
 * A site's own block: a design (or, for blocks written in code, an HTML template or a React
 * component the server draws) with properties editors fill in, such as a "Team card" with a
 * Name, a Photo, a Role and a "Show LinkedIn" toggle. docs/decisions/0023-custom-blocks.md
 * explains the choices.
 *
 * A page holds an instance as one element that names the block and keeps only the values:
 *
 *   { "type": "customBlock", "props": { "block": "team_card",
 *     "values": { "name": "Ada", "photo": "<asset id>", "show_linkedin": true } } }
 *
 * The design itself lives in the block, so changing it changes every page that uses it.
 */

/**
 * One property, written exactly like a content type's field (`handle`, `label`, `type`,
 * `required`, `helpText`, `options`, `width`, `conditions`, `validation`, `default`...), so
 * the field editor's types and settings work for blocks unchanged. The server checks them
 * with the same rules as a blueprint's fields.
 */
export interface BlockProperty {
  handle: string;
  label: string;
  type: string;
  required?: boolean;
  helpText?: string;
  options?: Readonly<Record<string, unknown>>;
  readonly [setting: string]: unknown;
}

/** Made in the builder, written in a `.block.ts` file, or added by a plugin. */
export type BlockSource = "site" | "code" | "plugin";

export interface CustomBlock {
  /** `team_card`: lowercase letters, numbers and underscores. */
  handle: string;
  name: string;
  /** A lucide icon name for the Insert panel. */
  icon: string;
  /** Groups blocks within "Your site's blocks": "Team", "Marketing"... */
  category: string;
  description: string;
  source: BlockSource;
  properties: readonly BlockProperty[];
  /**
   * The design, for blocks made in the builder: one element (with everything inside it)
   * whose `bindings` point at properties instead of an entry's fields (see block-bindings.ts).
   */
  design: PageNode | null;
  /**
   * For blocks in code: an HTML template with `{{property}}` slots (block-template.ts), or
   * null when the server draws a React component and sends the HTML with the page's data.
   */
  template: string | null;
  /** Property handles that were renamed, old to new, so older instances keep their values. */
  renamedProperties: Readonly<Record<string, string>>;
}

/** The element type every instance has. */
export const customBlockType = "customBlock";

export const blockHandlePattern = /^[a-z][a-z0-9_]{0,63}$/;

const blockInstancePropsSchema = z.object({
  block: z
    .string({ error: "A block should name which of the site’s blocks it is" })
    .regex(blockHandlePattern, { error: "A block’s name should be a handle like “team_card”" }),
  values: z
    .record(z.string(), z.unknown(), { error: "A block’s values should be an object" })
    .default({}),
});

export type BlockInstanceProps = z.output<typeof blockInstancePropsSchema>;

/**
 * An instance of one of the site's blocks. It is never listed in Insert on its own: the
 * panel offers each block by name ("Your site's blocks"). Its values are checked against
 * the block's properties by the server, which knows the blocks; the page check here only
 * checks the shape.
 */
export const customBlockComponent = defineComponent({
  type: customBlockType,
  label: "Block",
  description: "One of your site’s own blocks: its design is kept, you fill in its details.",
  icon: "component",
  category: "blocks",
  propsSchema: blockInstancePropsSchema,
  defaultProps: { block: "block", values: {} },
  allowedChildren: "none",
  editableFields: [],
  hiddenFromInsert: true,
});

/** The block an instance node is of, or null when the node isn't an instance. */
export function instanceBlockHandle(node: PageNode): string | null {
  if (node.type !== customBlockType) return null;
  return typeof node.props.block === "string" ? node.props.block : null;
}

/** An instance's values, as stored. */
export function instanceValues(node: PageNode): Record<string, unknown> {
  const values = node.props.values;
  return typeof values === "object" && values !== null && !Array.isArray(values)
    ? (values as Record<string, unknown>)
    : {};
}

/**
 * Values with renamed properties under their new handles. A value stored under both keeps
 * the new one. Renames are applied in a chain, so a property renamed twice still finds its
 * oldest values.
 */
export function currentValues(
  values: Readonly<Record<string, unknown>>,
  renamedProperties: Readonly<Record<string, string>>,
): Record<string, unknown> {
  const current: Record<string, unknown> = { ...values };
  for (const oldHandle of Object.keys(values)) {
    let handle = oldHandle;
    const seen = new Set<string>();
    while (renamedProperties[handle] && !seen.has(handle)) {
      seen.add(handle);
      handle = renamedProperties[handle] as string;
    }
    if (handle !== oldHandle) {
      if (current[handle] === undefined) current[handle] = values[oldHandle];
      delete current[oldHandle];
    }
  }
  return current;
}

/** A new instance's props: no values yet, so it shows the block's design as it was made. */
export function newInstanceProps(handle: string): BlockInstanceProps {
  return { block: handle, values: {} };
}

/** Every instance in a tree, optionally only of one block. Hidden ones count too. */
export function findBlockInstances(root: PageNode, handle?: string): PageNode[] {
  const found: PageNode[] = [];
  const visit = (node: PageNode) => {
    const block = instanceBlockHandle(node);
    if (block && (handle === undefined || block === handle)) found.push(node);
    node.children.forEach(visit);
  };
  visit(root);
  return found;
}
