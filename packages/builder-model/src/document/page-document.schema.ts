import { motionSpecSchema, type MotionSpec } from "@lintel/motion/schema";
import { z } from "zod";
import {
  isSafeStyleValue,
  isStylePropertyName,
  type StylePropertyName,
} from "../styles/style-properties.js";

/**
 * A page is a tree of nodes, stored as versioned JSON:
 *
 *   { "version": 1,
 *     "root": { "id": "page", "type": "page", "name": "", "props": {}, "styles": { "base": {} },
 *               "hidden": false, "locked": false,
 *               "children": [ { "id": "k3j9x2", "type": "section", ... } ] } }
 *
 * `props` hold what the node shows (a heading's text, an image's address) and are checked by
 * the node's component definition. `styles` hold how it looks, per screen size and state.
 * docs/decisions/0015-page-documents.md explains the choices.
 */

export const pageDocumentVersion = 1;

/** Screen sizes, widest first. Styles cascade down: tablet starts from desktop, phone from tablet. */
export const breakpoints = ["base", "tablet", "phone"] as const;
export type Breakpoint = (typeof breakpoints)[number];

/** Styles that apply only while the pointer is over a node, or it has keyboard focus. */
export const styleStates = ["hover", "focus"] as const;
export type StyleState = (typeof styleStates)[number];

/** Where a group of styles applies: a screen size, or a state. */
export type StyleTarget = Breakpoint | StyleState;

export type StyleDeclarations = Partial<Record<StylePropertyName, string>>;

export interface NodeStyles {
  base: StyleDeclarations;
  tablet?: StyleDeclarations;
  phone?: StyleDeclarations;
  hover?: StyleDeclarations;
  focus?: StyleDeclarations;
}

/**
 * How an element moves: an animation spec from `@lintel/motion`, played on the published
 * page by the motion runtime, and the preset it started from (so the builder can name it).
 */
export interface NodeAnimation {
  spec: MotionSpec;
  presetId?: string;
}

export interface PageNode {
  /** Made when the node is added and never changed, so selection and history follow it. */
  id: string;
  /** The component it is: "section", "heading", "image"... */
  type: string;
  /** The name in the Layers panel, and the start of its class name. Empty uses the component's. */
  name: string;
  props: Record<string, unknown>;
  styles: NodeStyles;
  children: PageNode[];
  /** Left out of the page entirely, but kept in the Layers panel. */
  hidden: boolean;
  /** Can't be moved, changed or deleted until it is unlocked. */
  locked: boolean;
  /** Left out when the element doesn't move. */
  animation?: NodeAnimation;
}

export interface PageDocument {
  version: typeof pageDocumentVersion;
  root: PageNode;
}

/** The deepest a page can nest, and the most nodes it can have; real pages are far smaller. */
export const maxNodeDepth = 40;
export const maxNodeCount = 5000;

export const nodeIdSchema = z
  .string({ error: "Each element needs an id" })
  .regex(/^[A-Za-z0-9_-]{1,64}$/, {
    error: "An element id can only have letters, numbers, - and _",
  });

const styleDeclarationsSchema = z
  .record(z.string(), z.string({ error: "Style values should be text" }))
  .superRefine((declarations, context) => {
    for (const [name, value] of Object.entries(declarations)) {
      if (!isStylePropertyName(name)) {
        context.addIssue({ code: "custom", message: `“${name}” isn’t a style the builder knows` });
      } else if (!isSafeStyleValue(value)) {
        context.addIssue({ code: "custom", message: `“${value}” isn’t a value ${name} can have` });
      }
    }
  })
  .transform((declarations) => declarations as StyleDeclarations);

export const nodeStylesSchema = z.object({
  base: styleDeclarationsSchema.default({}),
  tablet: styleDeclarationsSchema.optional(),
  phone: styleDeclarationsSchema.optional(),
  hover: styleDeclarationsSchema.optional(),
  focus: styleDeclarationsSchema.optional(),
});

const nodeAnimationSchema = z.object({
  spec: motionSpecSchema,
  presetId: z
    .string()
    .regex(/^[a-z0-9-]{1,80}$/, { error: "An animation’s preset should be a name like “fade-up”" })
    .optional(),
});

export const pageNodeSchema: z.ZodType<PageNode> = z.lazy(() =>
  z.object({
    id: nodeIdSchema,
    type: z.string({ error: "Each element needs a type" }).regex(/^[A-Za-z][A-Za-z0-9-]{0,63}$/, {
      error: "An element’s type should be a name like “heading”",
    }),
    name: z
      .string({ error: "A layer name should be text" })
      .max(80, { error: "Layer names can be at most 80 characters" })
      .default(""),
    props: z
      .record(z.string(), z.unknown(), { error: "An element’s content should be an object" })
      .default({}),
    styles: nodeStylesSchema.default({ base: {} }),
    children: z
      .array(pageNodeSchema, { error: "An element’s children should be a list" })
      .default([]),
    hidden: z.boolean({ error: "hidden should be true or false" }).default(false),
    locked: z.boolean({ error: "locked should be true or false" }).default(false),
    animation: nodeAnimationSchema.optional(),
  }),
);

export const pageDocumentSchema = z.object({
  version: z.literal(pageDocumentVersion, {
    error: `The page version should be ${pageDocumentVersion}`,
  }),
  root: pageNodeSchema,
});

/** The id every page's root node has. */
export const rootNodeId = "page";

/** A page with nothing on it yet: what a new page field starts as. */
export function createEmptyPage(): PageDocument {
  return {
    version: pageDocumentVersion,
    root: {
      id: rootNodeId,
      type: "page",
      name: "",
      props: {},
      styles: { base: {} },
      children: [],
      hidden: false,
      locked: false,
    },
  };
}
