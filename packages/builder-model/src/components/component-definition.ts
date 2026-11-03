import type { z } from "zod";
import type { BackgroundVideo } from "../backgrounds/background-video.js";
import type {
  NodeAnimation,
  NodeBindings,
  NodeEffect,
  NodeStyles,
} from "../document/page-document.schema.js";
import type { FreeLayout } from "../free-layout/free-layout.js";

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
  /** Effects a new one starts with (see @lintel/motion/effects), such as a magnetic pull. */
  defaultEffects?: readonly NodeEffect[];
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
  /** Only offered while this plugin is switched on (the shop's elements, forms). */
  requiresPlugin?: ComponentPlugin;
}

/** The plugins some elements belong to. */
export type ComponentPlugin = "commerce" | "forms";

export const componentCategories = [
  "blocks",
  "layout",
  "text",
  "media",
  "navigation",
  "collections",
  "forms",
  "shop",
  "code",
] as const;
export type ComponentCategory = (typeof componentCategories)[number];

/** A new node before it has an id: what templates and default children are written as. */
export interface NodeBlueprint {
  type: string;
  name?: string;
  props?: Record<string, unknown>;
  styles?: NodeStyles;
  children?: readonly NodeBlueprint[];
  animation?: NodeAnimation;
  effects?: readonly NodeEffect[];
  freeLayout?: FreeLayout;
  backgroundVideo?: BackgroundVideo;
  bindings?: NodeBindings;
}

/**
 * One control in the Content panel. `prop` is the prop it edits; `label` is plain English.
 * The kinds are deliberately few, so every component's panel looks familiar.
 */
export type EditableField = SimpleField | ListOfItemsField | SourceField;

/** What every field has. `advanced` fields are folded away under "More options". */
interface FieldBase {
  prop: string;
  label: string;
  advanced?: boolean;
}

/** The fields an item of a list (a slide, a plan, a person) can have too. */
export type SimpleField = FieldBase &
  (
    | { kind: "text"; placeholder?: string }
    | { kind: "multilineText"; placeholder?: string }
    | { kind: "choice"; choices: readonly { value: string; label: string }[] }
    | { kind: "toggle" }
    | { kind: "link" }
    | { kind: "image" }
    | { kind: "textList"; itemLabel: string }
    | { kind: "linkList" }
    | { kind: "number"; min?: number; max?: number; step?: number; unit?: string }
    | { kind: "dateTime" }
    | { kind: "icon" }
  );

/**
 * A list of items that each have a few fields of their own: a gallery's pictures, a pricing
 * table's plans. `titleField` is the item field that names each item in the panel.
 */
export type ListOfItemsField = FieldBase & {
  kind: "itemList";
  itemLabel: string;
  fields: readonly SimpleField[];
  titleField: string;
  /** What a new item starts as. */
  newItem: Readonly<Record<string, unknown>>;
  maxItems?: number;
};

/**
 * A choice of something the site has, which the app lists: one of its collections, a
 * category to filter by, a form, a product. With nothing to list it is a text box.
 */
export type SourceField = FieldBase & {
  kind: "source";
  source: DataSourceKind;
  /** Collections' terms are listed for the collection named in this prop. */
  dependsOn?: string;
};

export const dataSourceKinds = [
  "collections",
  "terms",
  "forms",
  "products",
  "productCollections",
] as const;
export type DataSourceKind = (typeof dataSourceKinds)[number];

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
