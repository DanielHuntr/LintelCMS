import { z } from "zod";
import {
  type NodeStyles,
  nodeStylesSchema,
  type PageNode,
  type StyleDeclarations,
} from "../document/page-document.schema.js";
import type { StylePropertyName } from "../styles/style-properties.js";

/**
 * Shared styles: a look saved under a name ("Card", "Button – main") and used by many
 * elements across the site. An element that uses one stores only its id
 * (`"sharedStyle": "card"`); when a page is drawn, the shared look goes under the element's
 * own styles, so changing the shared style changes every element that uses it, and anything
 * the element sets for itself still wins ("only this one").
 *
 * A shared style holds how things look, never where they are: places on a grid or in a free
 * layout, and stacking, stay on each element (see `placeProperties`).
 */
export interface SharedStyle {
  id: string;
  name: string;
  styles: SharedStyles;
  /**
   * A variant ("Outline" of "Button") names the shared style it's a variant of. It looks
   * like that one, with its own styles over it, so changing the button changes the outline
   * button too. Only one level: a variant of a variant is a variant of the first.
   */
  variantOf?: string;
}

/** A node's styles without styles that follow another element ("while the card is hovered"). */
export type SharedStyles = Omit<NodeStyles, "owners">;

export const maxSharedStyles = 200;

export const sharedStyleIdSchema = z.string().regex(/^[a-z][a-z0-9-]{0,39}$/, {
  error: "A shared style’s id should be a short name like “card”",
});

export const sharedStyleSchema = z.object({
  id: sharedStyleIdSchema,
  name: z
    .string({ error: "Please give the shared style a name" })
    .trim()
    .min(1, { error: "Please give the shared style a name" })
    .max(40, { error: "Shared style names can be at most 40 characters" }),
  styles: nodeStylesSchema.omit({ owners: true }).default({ base: {} }),
  variantOf: sharedStyleIdSchema.optional(),
});

/** Where an element sits, which stays with the element when its look is shared. */
export const placeProperties: readonly StylePropertyName[] = [
  "gridColumn",
  "gridRow",
  "gridArea",
  "justifySelf",
  "alignSelf",
  "order",
  "position",
  "left",
  "top",
  "right",
  "bottom",
  "zIndex",
];

const styleKeys = [
  "base",
  "tablet",
  "phone",
  "hover",
  "pressed",
  "focus",
  "open",
  "selected",
] as const;

/** Splits declarations into where the element is and how it looks. */
function split(declarations: StyleDeclarations | undefined) {
  const place: StyleDeclarations = {};
  const look: StyleDeclarations = {};
  for (const [property, value] of Object.entries(declarations ?? {}) as Array<
    [StylePropertyName, string]
  >) {
    if (placeProperties.includes(property)) place[property] = value;
    else look[property] = value;
  }
  return { place, look };
}

/** Styles with only the targets that have something in them; `base` is always there. */
function tidy(styles: Partial<Record<(typeof styleKeys)[number], StyleDeclarations>>): NodeStyles {
  const result: NodeStyles = { base: styles.base ?? {} };
  for (const key of styleKeys) {
    const declarations = styles[key];
    if (key !== "base" && declarations && Object.keys(declarations).length > 0) {
      result[key] = declarations;
    }
  }
  return result;
}

/** `over` laid on `under`, target by target: what `over` sets wins. */
export function layerStyles(under: SharedStyles, over: NodeStyles): NodeStyles {
  const merged: Partial<Record<(typeof styleKeys)[number], StyleDeclarations>> = {};
  for (const key of styleKeys) {
    if (under[key] || over[key]) merged[key] = { ...under[key], ...over[key] };
  }
  const result = tidy(merged);
  return over.owners ? { ...result, owners: over.owners } : result;
}

/**
 * A new shared style from an element's look, and the element using it: its look moves into
 * the shared style, and only its place stays on the element.
 */
export function makeSharedStyle(
  node: PageNode,
  id: string,
  name: string,
): { sharedStyle: SharedStyle; node: PageNode } {
  const looks: Partial<Record<(typeof styleKeys)[number], StyleDeclarations>> = {};
  const places: Partial<Record<(typeof styleKeys)[number], StyleDeclarations>> = {};
  for (const key of styleKeys) {
    const { place, look } = split(node.styles[key]);
    looks[key] = look;
    places[key] = place;
  }
  const kept = tidy(places);
  return {
    sharedStyle: { id, name, styles: tidy(looks) },
    node: {
      ...node,
      sharedStyle: id,
      styles: node.styles.owners ? { ...kept, owners: node.styles.owners } : kept,
    },
  };
}

/**
 * An element starts using a shared style: its own look is taken off, so it looks exactly
 * like the others, and its place stays.
 */
export function giveSharedStyle(node: PageNode, id: string): PageNode {
  const places: Partial<Record<(typeof styleKeys)[number], StyleDeclarations>> = {};
  for (const key of styleKeys) places[key] = split(node.styles[key]).place;
  const kept = tidy(places);
  return {
    ...node,
    sharedStyle: id,
    styles: node.styles.owners ? { ...kept, owners: node.styles.owners } : kept,
  };
}

/** The element stops using its shared style and keeps the look it has, as its own. */
export function detachSharedStyle(node: PageNode, sharedStyle: SharedStyle | undefined): PageNode {
  const rest: PageNode = { ...node };
  delete rest.sharedStyle;
  return sharedStyle ? { ...rest, styles: layerStyles(sharedStyle.styles, node.styles) } : rest;
}

/**
 * The page as it is drawn: every element using a shared style gets that look under its own
 * styles. Elements whose shared style no longer exists keep only their own. Parts of the
 * tree with nothing shared are handed back as they were.
 */
export function applySharedStyles(
  root: PageNode,
  library: Readonly<Record<string, SharedStyle>> | undefined,
): PageNode {
  if (!library || Object.keys(library).length === 0) return root;
  const visit = (node: PageNode): PageNode => {
    const children = node.children.map(visit);
    const changedChildren = children.some((child, index) => child !== node.children[index]);
    const shared = node.sharedStyle ? library[node.sharedStyle] : undefined;
    if (!shared && !changedChildren) return node;
    return {
      ...node,
      ...(shared ? { styles: layerStyles(shared.styles, node.styles) } : {}),
      children: changedChildren ? children : node.children,
    };
  };
  return visit(root);
}

/** How many elements on a page use each shared style. */
export function countSharedStyleUses(root: PageNode): Map<string, number> {
  const counts = new Map<string, number>();
  const visit = (node: PageNode) => {
    if (node.sharedStyle) counts.set(node.sharedStyle, (counts.get(node.sharedStyle) ?? 0) + 1);
    node.children.forEach(visit);
  };
  visit(root);
  return counts;
}

/**
 * The shared styles as pages are drawn with them, by id: a variant's look is its base's with
 * its own over it. A variant whose base is gone keeps only its own look.
 */
export function resolveSharedStyles(
  sharedStyles: readonly SharedStyle[],
): Record<string, SharedStyle> {
  const byId = new Map(sharedStyles.map((each) => [each.id, each]));
  return Object.fromEntries(
    sharedStyles.map((each) => {
      const base = each.variantOf ? byId.get(each.variantOf) : undefined;
      if (!base || base.variantOf) return [each.id, each];
      const styles = layerStyles(base.styles, each.styles);
      return [each.id, { ...each, styles }];
    }),
  );
}

/** The shared style a variant belongs to, or the style itself when it isn't a variant. */
export function baseSharedStyleOf(
  sharedStyle: SharedStyle,
  sharedStyles: readonly SharedStyle[],
): SharedStyle {
  if (!sharedStyle.variantOf) return sharedStyle;
  return sharedStyles.find((each) => each.id === sharedStyle.variantOf) ?? sharedStyle;
}

/** A shared style's variants, in the order they were made. */
export function variantsOf(
  sharedStyle: SharedStyle,
  sharedStyles: readonly SharedStyle[],
): SharedStyle[] {
  return sharedStyles.filter((each) => each.variantOf === sharedStyle.id);
}

/** "Button · Outline" for a variant, "Button" for a shared style that isn't one. */
export function sharedStyleTitle(
  sharedStyle: SharedStyle,
  sharedStyles: readonly SharedStyle[],
): string {
  const base = baseSharedStyleOf(sharedStyle, sharedStyles);
  return base === sharedStyle ? sharedStyle.name : `${base.name} · ${sharedStyle.name}`;
}
