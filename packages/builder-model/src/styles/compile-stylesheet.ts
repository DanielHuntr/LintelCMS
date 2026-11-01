import type {
  Breakpoint,
  NodeStyles,
  PageNode,
  StyleDeclarations,
} from "../document/page-document.schema.js";
import { compileFontFaces, readPageFonts } from "../fonts/page-fonts.js";
import { impliedFreeLayoutStyles } from "../free-layout/free-layout.js";
import { planMarkDrawings, type TextMark } from "../text-marks/text-marks.js";
import { breakpointWidths } from "./style-cascade.js";
import { stylePropertyNames, styleProperties } from "./style-properties.js";

/**
 * Turns a page's node styles into a plain, readable stylesheet: the page's added fonts, one
 * rule per node class, then hover and focus rules, then a media query per smaller screen size.
 *
 *   .hero {
 *     padding-top: var(--lintel-space-8);
 *   }
 *   .button:hover {
 *     opacity: 0.88;
 *   }
 *   @media (max-width: 767px) {
 *     .hero {
 *       padding-top: var(--lintel-space-7);
 *     }
 *   }
 *
 * A few rules come from settings rather than styles: a free layout's `position`s (and its
 * stacking on phones), a background video's overlay, and the classes for styled parts of
 * text (`.title-mark-1`). Hidden nodes (and everything inside them) are left out, as they are
 * from the HTML. Declarations are always printed in the same order, so the same page gives
 * the same CSS. Code blocks' own CSS follows at the end, after a comment saying whose it is.
 */
export function compileStylesheet(root: PageNode, classNames: ReadonlyMap<string, string>): string {
  const visible = listVisibleNodes(root);
  const ruleFor = (
    node: PageNode,
    declarations: StyleDeclarations | undefined,
    suffix = "",
    indent = "",
  ) => {
    const className = classNames.get(node.id);
    return className && declarations
      ? formatRule(`.${className}${suffix}`, declarations, indent)
      : null;
  };
  const styled = (entry: VisibleNode, breakpoint: Breakpoint) =>
    withImplied(entry.implied[breakpoint], entry.node.styles[breakpoint]);

  const sections: string[] = [];
  const fonts = root.type === "page" ? compileFontFaces(readPageFonts(root.props)) : "";
  if (fonts) sections.push(fonts);
  const base = visible.map((entry) => ruleFor(entry.node, styled(entry, "base")));
  const states = visible.flatMap(({ node }) => [
    ruleFor(node, node.styles.hover, ":hover"),
    ruleFor(node, node.styles.focus, ":focus-visible"),
  ]);
  const extras = visible.flatMap(({ node }) => extraRules(node, classNames.get(node.id)));
  sections.push(...compact([...base, ...extras, ...states]));

  for (const breakpoint of ["tablet", "phone"] as const) {
    const rules = compact(
      visible.map((entry) => ruleFor(entry.node, styled(entry, breakpoint), "", "  ")),
    );
    if (rules.length > 0) {
      sections.push(
        `@media (max-width: ${breakpointWidths[breakpoint]}px) {\n${rules.join("\n\n")}\n}`,
      );
    }
  }

  for (const { node } of visible) {
    const css = node.type === "codeBlock" ? node.props.css : undefined;
    if (typeof css === "string" && css.trim() !== "") {
      sections.push(`/* Code: .${classNames.get(node.id) ?? node.id} */\n${css.trim()}`);
    }
  }
  return sections.length === 0 ? "" : `${sections.join("\n\n")}\n`;
}

/** One rule, or null when it would be empty. */
export function formatRule(
  selector: string,
  declarations: StyleDeclarations,
  indent = "",
): string | null {
  const lines = stylePropertyNames.flatMap((property) => {
    const value = declarations[property];
    if (value === undefined) return [];
    const { cssName, alsoPrintedAs = [] } = styleProperties[property] as {
      cssName: string;
      alsoPrintedAs?: readonly string[];
    };
    return [...alsoPrintedAs, cssName].map((name) => `${indent}  ${name}: ${value};`);
  });
  return lines.length === 0 ? null : `${indent}${selector} {\n${lines.join("\n")}\n${indent}}`;
}

/** The node's own styles over the ones its settings imply, or undefined when both are empty. */
function withImplied(
  implied: StyleDeclarations | undefined,
  own: StyleDeclarations | undefined,
): StyleDeclarations | undefined {
  if (!implied) return own;
  return { ...implied, ...own };
}

/** Rules for a background video's overlay and for styled parts of text. */
function extraRules(node: PageNode, className: string | undefined): string[] {
  if (!className) return [];
  const rules: Array<string | null> = [];
  const overlay = node.backgroundVideo?.overlay;
  if (overlay) {
    rules.push(
      formatRule(`.${className} > .lintel-video-background::after`, { backgroundColor: overlay }),
    );
  }
  const marks = Array.isArray(node.props.marks) ? (node.props.marks as TextMark[]) : [];
  const printed = new Set<number>();
  for (const drawing of planMarkDrawings(marks)) {
    if (drawing.classNumber === null || printed.has(drawing.classNumber)) continue;
    printed.add(drawing.classNumber);
    rules.push(formatRule(`.${className}-mark-${drawing.classNumber}`, drawing.declarations));
  }
  return compact(rules);
}

interface VisibleNode {
  node: PageNode;
  implied: Partial<NodeStyles>;
}

function listVisibleNodes(root: PageNode): VisibleNode[] {
  const nodes: VisibleNode[] = [];
  const visit = (node: PageNode, parent: PageNode | null) => {
    if (node.hidden) return;
    const implied = impliedFreeLayoutStyles(node, parent);
    if (node.backgroundVideo) {
      implied.base = { position: "relative", isolation: "isolate", ...implied.base };
    }
    nodes.push({ node, implied });
    node.children.forEach((child) => visit(child, node));
  };
  visit(root, null);
  return nodes;
}

function compact<Value>(values: ReadonlyArray<Value | null>): Value[] {
  return values.filter((value): value is Value => value !== null);
}
