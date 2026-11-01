import type { PageNode, StyleDeclarations } from "../document/page-document.schema.js";
import { breakpointWidths } from "./style-cascade.js";
import { stylePropertyNames, styleProperties } from "./style-properties.js";

/**
 * Turns a page's node styles into a plain, readable stylesheet: one rule per node class,
 * then hover and focus rules, then a media query per smaller screen size.
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
 * Hidden nodes (and everything inside them) are left out, as they are from the HTML.
 * Declarations are always printed in the same order, so the same page gives the same CSS.
 * Code blocks' own CSS follows at the end, after a comment saying whose it is.
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

  const sections: string[] = [];
  const base = visible.map((node) => ruleFor(node, node.styles.base));
  const states = visible.flatMap((node) => [
    ruleFor(node, node.styles.hover, ":hover"),
    ruleFor(node, node.styles.focus, ":focus-visible"),
  ]);
  sections.push(...compact([...base, ...states]));

  for (const breakpoint of ["tablet", "phone"] as const) {
    const rules = compact(visible.map((node) => ruleFor(node, node.styles[breakpoint], "", "  ")));
    if (rules.length > 0) {
      sections.push(
        `@media (max-width: ${breakpointWidths[breakpoint]}px) {\n${rules.join("\n\n")}\n}`,
      );
    }
  }

  for (const node of visible) {
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
    return value === undefined
      ? []
      : [`${indent}  ${styleProperties[property].cssName}: ${value};`];
  });
  return lines.length === 0 ? null : `${indent}${selector} {\n${lines.join("\n")}\n${indent}}`;
}

function listVisibleNodes(root: PageNode): PageNode[] {
  const nodes: PageNode[] = [];
  const visit = (node: PageNode) => {
    if (node.hidden) return;
    nodes.push(node);
    node.children.forEach(visit);
  };
  visit(root);
  return nodes;
}

function compact<Value>(values: ReadonlyArray<Value | null>): Value[] {
  return values.filter((value): value is Value => value !== null);
}
