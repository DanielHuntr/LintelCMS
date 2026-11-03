import { nodeEffectsSchema, type NodeEffect } from "@lintel/motion/effects";
import { motionSpecSchema, type MotionSpec } from "@lintel/motion/schema";
import { z } from "zod";
import { type BackgroundVideo, backgroundVideoSchema } from "../backgrounds/background-video.js";
import { type FreeLayout, freeLayoutSchema } from "../free-layout/free-layout.js";
import { isStylePropertyName, type StylePropertyName } from "../styles/style-properties.js";
import { isSafeValueFor } from "../styles/style-values.js";

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

export const pageDocumentVersion = 2;

/** Screen sizes, widest first. Styles cascade down: tablet starts from desktop, phone from tablet. */
export const breakpoints = ["base", "tablet", "phone"] as const;
export type Breakpoint = (typeof breakpoints)[number];

/**
 * Styles that apply only in a state: while the pointer is over a node, while it's pressed,
 * while it has keyboard focus, while it's open (its button toggles it, on the website), or
 * while it's the selected one (the current page in a menu, the chosen tab, a pressed toggle).
 */
export const styleStates = ["hover", "pressed", "focus", "open", "selected"] as const;
export type StyleState = (typeof styleStates)[number];

/**
 * Styles a node takes while another element around it (its "owner", such as a card) is in a
 * state: `"hover@n3"` is "while n3 is hovered". So a card's picture can grow and its button
 * fill when the card is hovered, all moving together.
 */
export type OwnerStateTarget = `${StyleState}@${string}`;

/** Where a group of styles applies: a screen size, a state, or an owner's state. */
export type StyleTarget = Breakpoint | StyleState | OwnerStateTarget;

/** How an element (and what follows its states) moves between its states. */
export interface StateTransition {
  feel: "smooth" | "springy" | "instant";
  speed: "quick" | "steady" | "slow";
}

export type StyleDeclarations = Partial<Record<StylePropertyName, string>>;

export interface NodeStyles {
  base: StyleDeclarations;
  tablet?: StyleDeclarations;
  phone?: StyleDeclarations;
  hover?: StyleDeclarations;
  pressed?: StyleDeclarations;
  focus?: StyleDeclarations;
  open?: StyleDeclarations;
  selected?: StyleDeclarations;
  /** Styles while an element around this one is in a state, keyed `"hover@<owner id>"`. */
  owners?: Partial<Record<OwnerStateTarget, StyleDeclarations>>;
}

/**
 * How an element moves: an animation spec from `@lintel/motion`, played on the published
 * page by the motion runtime, and the preset it started from (so the builder can name it).
 */
export interface NodeAnimation {
  spec: MotionSpec;
  presetId?: string;
}

export type { NodeEffect };

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
  /**
   * How it moves: one or more animations, such as fading in when it appears and lifting on
   * hover. Left out when the element doesn't move. (Pages before version 2 had one,
   * `animation`; they're migrated when read.)
   */
  animations?: NodeAnimation[];
  /**
   * Effects from the Effects library (`@lintel/motion/effects`): magnetic pull, tilt,
   * scramble... Several can be on one element, alongside its animation. Left out for none.
   */
  effects?: NodeEffect[];
  /** How it, and what changes with its states, moves between states. Left out: no easing. */
  stateTransition?: StateTransition;
  /** Its children are placed anywhere in it (see free-layout/). Left out for normal flow. */
  freeLayout?: FreeLayout;
  /** A muted, looping video behind its content (see backgrounds/). */
  backgroundVideo?: BackgroundVideo;
  /**
   * Inside a collection list (or on a collection's item page), props filled from the current
   * entry instead of typed in: `{ "text": "title", "src": "image" }`. Left out when unbound.
   */
  bindings?: NodeBindings;
}

/** A prop name to the entry field it shows ("title", "image", "data.price"...). */
export type NodeBindings = Record<string, string>;

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
      } else if (!isSafeValueFor(name, value)) {
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
  pressed: styleDeclarationsSchema.optional(),
  focus: styleDeclarationsSchema.optional(),
  open: styleDeclarationsSchema.optional(),
  selected: styleDeclarationsSchema.optional(),
  owners: z
    .record(
      z.string().regex(/^(hover|pressed|focus|open|selected)@[A-Za-z0-9_-]{1,64}$/, {
        error: "An owner state should look like “hover@n3”",
      }),
      styleDeclarationsSchema,
    )
    .optional(),
});

export const stateTransitionSchema = z.object({
  feel: z.enum(["smooth", "springy", "instant"]).default("smooth"),
  speed: z.enum(["quick", "steady", "slow"]).default("steady"),
});

/** Whether a style target is an owner's state, like `"hover@n3"`. */
export function isOwnerStateTarget(target: StyleTarget): target is OwnerStateTarget {
  return target.includes("@");
}

/** `"hover@n3"` as its parts; undefined for any other target. */
export function readOwnerStateTarget(
  target: StyleTarget,
): { state: StyleState; ownerId: string } | undefined {
  if (!isOwnerStateTarget(target)) return undefined;
  const [state, ownerId] = target.split("@") as [StyleState, string];
  return { state, ownerId };
}

/** Whether a style target is a state (its own or an owner's), rather than a screen size. */
export function isStateTarget(target: StyleTarget): boolean {
  return isOwnerStateTarget(target) || (styleStates as readonly string[]).includes(target);
}

/** Enough for an entrance, a hover and a scroll step or two, without piling up. */
export const maxAnimationsPerElement = 6;

const nodeAnimationSchema = z.object({
  spec: motionSpecSchema,
  presetId: z
    .string()
    .regex(/^[a-z0-9-]{1,80}$/, { error: "An animation’s preset should be a name like “fade-up”" })
    .optional(),
});

const fieldPathPattern = /^[A-Za-z][\w.-]{0,79}$/;

export const nodeBindingsSchema = z
  .record(
    z.string().regex(fieldPathPattern, { error: "A bound prop should be a name like “text”" }),
    z.string().regex(fieldPathPattern, { error: "A bound field should be a name like “title”" }),
  )
  .refine((bindings) => Object.keys(bindings).length <= 30, {
    error: "An element can show at most 30 fields",
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
    animations: z.array(nodeAnimationSchema).min(1).max(maxAnimationsPerElement).optional(),
    effects: nodeEffectsSchema.optional(),
    stateTransition: stateTransitionSchema.optional(),
    freeLayout: freeLayoutSchema.optional(),
    backgroundVideo: backgroundVideoSchema.optional(),
    bindings: nodeBindingsSchema.optional(),
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
