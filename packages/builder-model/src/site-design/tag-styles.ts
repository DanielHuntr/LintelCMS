import { z } from "zod";
import {
  type NodeStyles,
  nodeStylesSchema,
  type PageNode,
  type StyleDeclarations,
} from "../document/page-document.schema.js";
import { formatRule, stateSelectors } from "../styles/compile-stylesheet.js";
import { breakpointWidths } from "../styles/style-cascade.js";
import type { StylePropertyName } from "../styles/style-properties.js";
import { layerStyles, type SharedStyles } from "./shared-styles.js";

/**
 * Styles for every element of a kind: how every link, heading, paragraph, button and picture
 * on the site's designed pages looks unless it says otherwise. They're the bottom layer:
 * an element's own styles and its shared style always win.
 *
 * Headings, paragraphs and links get theirs from the site's stylesheet, with selectors no
 * stronger than a tag (`:where(.lintel-design) p`), so they also reach the headings and
 * links inside rich text, and any class wins. Buttons and pictures start with styles of their
 * own (a button's colour and padding are set on it when it's added), which a rule in the
 * stylesheet could never get under. For those, the kind's look replaces the element's
 * starting values when the page is drawn (`applyTagStyles`): anything changed on the element
 * stays on top, and elements with a shared style keep it.
 */
export const tagStyleKinds = ["headings", "paragraphs", "links", "buttons", "pictures"] as const;
export type TagStyleKind = (typeof tagStyleKinds)[number];

export type TagStyles = Partial<Record<TagStyleKind, SharedStyles>>;

export const tagStylesSchema = z.partialRecord(
  z.enum(tagStyleKinds),
  nodeStylesSchema.omit({ owners: true }),
);

/** What each kind matches in a designed page, as weak as a tag (or a class, for buttons). */
const selectors: Record<TagStyleKind, string> = {
  headings: ":where(.lintel-design) :is(h1, h2, h3, h4, h5, h6)",
  paragraphs: ":where(.lintel-design) p",
  // Not buttons that are links, not menus, which take their colour from the menu, and not
  // the Site logo, which is the site's name rather than a link in the text.
  links: ":where(.lintel-design) a:where(:not(.lintel-button, nav a, .lintel-site-logo))",
  // Buttons drawn by other elements (a form's Send, a pricing plan's): the Button element's
  // own look comes from `applyTagStyles`.
  buttons: ":where(.lintel-design) .lintel-button",
  pictures: ":where(.lintel-design) img",
};

/** The elements whose starting styles a kind's look replaces when the page is drawn. */
const elementTypes: Partial<Record<TagStyleKind, readonly string[]>> = {
  buttons: ["button"],
  pictures: ["image"],
};

/** Marks the part of the site's stylesheet these rules are in, so the builder can swap it. */
export const tagStylesStart = "/* lintel:tag-styles */";
export const tagStylesEnd = "/* lintel:tag-styles:end */";

const states = ["hover", "pressed", "focus"] as const;

/** The site's tag styles as rules for its stylesheet, between markers; empty for none. */
export function compileTagStyles(tagStyles: TagStyles | undefined): string {
  if (!tagStyles) return "";
  const rules: string[] = [];
  const media: Record<"tablet" | "phone", string[]> = { tablet: [], phone: [] };
  for (const kind of tagStyleKinds) {
    const styles = tagStyles[kind];
    if (!styles) continue;
    const selector = selectors[kind];
    const base = formatRule(selector, styles.base);
    if (base) rules.push(base);
    for (const state of states) {
      const declarations = styles[state];
      const rule = declarations && formatRule(`${selector}${stateSelectors[state]}`, declarations);
      if (rule) rules.push(rule);
    }
    for (const size of ["tablet", "phone"] as const) {
      const declarations = styles[size];
      const rule = declarations && formatRule(selector, declarations, "  ");
      if (rule) media[size].push(rule);
    }
  }
  for (const size of ["tablet", "phone"] as const) {
    if (media[size].length > 0) {
      rules.push(`@media (max-width: ${breakpointWidths[size]}px) {\n${media[size].join("\n")}\n}`);
    }
  }
  if (rules.length === 0) return "";
  return `${tagStylesStart}\n${rules.join("\n")}\n${tagStylesEnd}\n`;
}

/** A stylesheet with its tag-style rules taken out (to put the latest ones in their place). */
export function withoutTagStyles(stylesheet: string): string {
  const start = stylesheet.indexOf(tagStylesStart);
  const end = stylesheet.indexOf(tagStylesEnd);
  if (start === -1 || end === -1 || end < start) return stylesheet;
  return stylesheet.slice(0, start) + stylesheet.slice(end + tagStylesEnd.length);
}

type StyleKey = Exclude<keyof NodeStyles, "owners">;

/** Splits declarations into those still at the element's starting value and the rest. */
function splitStarting(
  own: StyleDeclarations | undefined,
  starting: StyleDeclarations | undefined,
): { starting: StyleDeclarations; changed: StyleDeclarations } {
  const kept: StyleDeclarations = {};
  const changed: StyleDeclarations = {};
  for (const [property, value] of Object.entries(own ?? {}) as Array<[StylePropertyName, string]>) {
    if (starting?.[property] === value) kept[property] = value;
    else changed[property] = value;
  }
  return { starting: kept, changed };
}

/**
 * The page as it's drawn with the site's looks for buttons and pictures: each one's
 * starting styles give way to the kind's look, and what was changed on it stays on top.
 * Elements with a shared style are left alone (the shared style wins). Parts of the tree
 * with nothing to change are handed back as they were.
 */
export function applyTagStyles(
  root: PageNode,
  tagStyles: TagStyles | undefined,
  startingStylesOf: (type: string) => NodeStyles | undefined,
): PageNode {
  if (!tagStyles) return root;
  const byType = new Map<string, SharedStyles>();
  for (const [kind, types] of Object.entries(elementTypes) as Array<
    [TagStyleKind, readonly string[]]
  >) {
    const look = tagStyles[kind];
    if (look) for (const type of types) byType.set(type, look);
  }
  if (byType.size === 0) return root;
  const visit = (node: PageNode): PageNode => {
    const children = node.children.map(visit);
    const changedChildren = children.some((child, index) => child !== node.children[index]);
    const look = node.sharedStyle ? undefined : byType.get(node.type);
    if (!look && !changedChildren) return node;
    let styles = node.styles;
    if (look) {
      const startingStyles = startingStylesOf(node.type);
      const keys = new Set<StyleKey>([
        ...(Object.keys(node.styles) as StyleKey[]),
        ...(Object.keys(look) as StyleKey[]),
      ]);
      const under: Partial<Record<StyleKey, StyleDeclarations>> = {};
      const over: Partial<Record<StyleKey, StyleDeclarations>> = {};
      for (const key of keys) {
        if ((key as string) === "owners") continue;
        const split = splitStarting(node.styles[key], startingStyles?.[key]);
        under[key] = { ...split.starting, ...look[key] };
        over[key] = split.changed;
      }
      styles = layerStyles(
        { base: under.base ?? {}, ...under },
        {
          ...over,
          base: over.base ?? {},
          ...(node.styles.owners ? { owners: node.styles.owners } : {}),
        },
      );
    }
    return { ...node, styles, children: changedChildren ? children : node.children };
  };
  return visit(root);
}

/** The tag styles without the kinds that have nothing in them. */
export function tidyTagStyles(tagStyles: TagStyles): TagStyles {
  const result: TagStyles = {};
  for (const kind of tagStyleKinds) {
    const styles = tagStyles[kind];
    if (!styles) continue;
    const hasAny = Object.values(styles).some(
      (declarations) => declarations && Object.keys(declarations).length > 0,
    );
    if (hasAny) result[kind] = styles;
  }
  return result;
}
