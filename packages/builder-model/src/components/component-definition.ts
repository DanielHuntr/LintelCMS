import type { z } from "zod";
import type { NodeStyles } from "../document/page-document.schema.js";

/**
 * What the builder knows about one kind of element, apart from how it draws: its name and
 * place in the Insert panel, the shape of its props, what it may contain and which of its
 * props an editor can change in the Content panel.
 *
 * The drawing half (a React component) is added by `@lintel/builder`, so this package stays
 * plain TypeScript the server can use to check a page without loading React.
 */
export interface ComponentDefinition<
  Props extends Record<string, unknown> = Record<string, unknown>,
> {
  type: string;
  /** Plain English, shown in the Insert and Layers panels: "Heading", "Picture". */
  label: string;
  /** One plain sentence for the Insert panel: what it is for, not how it works. */
  description: string;
  /** A lucide icon name, drawn by the editor ("heading", "image"...). */
  icon: string;
  category: ComponentCategory;
  /** Checks stored props and fills in defaults. Must accept `defaultProps`. */
  propsSchema: z.ZodType<Props>;
  defaultProps: Props;
  /** Styles a new one starts with, so it looks right straight away. */
  defaultStyles?: NodeStyles;
  /** Elements a new one starts with, such as the two halves of Columns. */
  defaultChildren?: readonly NodeBlueprint[];
  /** "none" for leaves, "any" for containers, or a list of the types it accepts. */
  allowedChildren: "none" | "any" | readonly string[];
  /** Only inside these types (a list item only in a list). Undefined means anywhere. */
  allowedParents?: readonly string[];
  /** The props the Content panel shows, in order. */
  editableFields: readonly EditableField[];
  /** Left out of the Insert panel, such as the page itself. */
  hiddenFromInsert?: boolean;
  /** Only people with the code permission can add or change it (code blocks). */
  requiresCodePermission?: boolean;
}

export const componentCategories = ["layout", "text", "media", "navigation", "code"] as const;
export type ComponentCategory = (typeof componentCategories)[number];

/** A new node before it has an id: what templates and default children are written as. */
export interface NodeBlueprint {
  type: string;
  name?: string;
  props?: Record<string, unknown>;
  styles?: NodeStyles;
  children?: readonly NodeBlueprint[];
}

/**
 * One control in the Content panel. `prop` is the prop it edits; `label` is plain English.
 * The kinds are deliberately few, so every component's panel looks familiar.
 */
export type EditableField =
  | { kind: "text"; prop: string; label: string; placeholder?: string }
  | { kind: "multilineText"; prop: string; label: string; placeholder?: string }
  | {
      kind: "choice";
      prop: string;
      label: string;
      choices: readonly { value: string; label: string }[];
    }
  | { kind: "toggle"; prop: string; label: string }
  | { kind: "link"; prop: string; label: string }
  | { kind: "image"; prop: string; label: string }
  | { kind: "textList"; prop: string; label: string; itemLabel: string }
  | { kind: "linkList"; prop: string; label: string };

export type EditableFieldKind = EditableField["kind"];

/** Defines a component with its props type checked against its schema and defaults. */
export function defineComponent<Props extends Record<string, unknown>>(
  definition: ComponentDefinition<Props>,
): ComponentDefinition<Props> {
  return definition;
}

/**
 * Definitions with their props type erased, so different components share one list. Props
 * are checked by `propsSchema` before anything reads them.
 */
export type AnyComponentDefinition = ComponentDefinition<Record<string, unknown>>;
