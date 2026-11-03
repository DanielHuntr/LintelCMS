import type { NodeStyles, PageNode, StyleDeclarations } from "../document/page-document.schema.js";
import type { StylePropertyName } from "../styles/style-properties.js";
import { type DesignVariable, variablePropertyName } from "./design-variables.js";

/**
 * Where the site's design variables are used: how many styles name each one (so the Styles
 * view can say "Used in 3 places" before something is deleted), and the value written out in
 * place of a variable (so deleting one leaves every element looking as it did).
 */

type AnyStyles = Partial<Omit<NodeStyles, "owners">> & { owners?: NodeStyles["owners"] };

function eachDeclarations(styles: AnyStyles | undefined): StyleDeclarations[] {
  if (!styles) return [];
  const own = Object.entries(styles).flatMap(([key, declarations]) =>
    key === "owners" ? [] : declarations ? [declarations as StyleDeclarations] : [],
  );
  return [...own, ...Object.values(styles.owners ?? {}).filter((each) => each !== undefined)];
}

/** The ids of the variables a value names: `var(--lintel-var-sand)` names `sand`. */
export function variablesIn(value: string): string[] {
  return [...value.matchAll(/var\(--lintel-var-([a-z][a-z0-9-]*)[\s,)]/g)].map(
    (match) => match[1] ?? "",
  );
}

/** How many declarations in these styles name each variable. */
export function countVariablesInStyles(styles: AnyStyles | undefined, into: Map<string, number>) {
  for (const declarations of eachDeclarations(styles)) {
    for (const value of Object.values(declarations)) {
      if (typeof value !== "string") continue;
      for (const id of variablesIn(value)) into.set(id, (into.get(id) ?? 0) + 1);
    }
  }
  return into;
}

/** How many declarations on a page (every element) name each variable. */
export function countVariableUses(root: PageNode, into = new Map<string, number>()) {
  const visit = (node: PageNode) => {
    countVariablesInStyles(node.styles, into);
    node.children.forEach(visit);
  };
  visit(root);
  return into;
}

/** A value with the variable written out: `var(--lintel-var-sand)` becomes `#efe6d6`. */
export function inlineVariableValue(value: string, variable: DesignVariable): string {
  const name = variablePropertyName(variable);
  return value.replace(new RegExp(`var\\(--${name}(?:\\s*,[^)]*)?\\)`, "g"), variable.value);
}

function inlineDeclarations(
  declarations: StyleDeclarations,
  variable: DesignVariable,
): StyleDeclarations {
  let changed = false;
  const next: StyleDeclarations = {};
  for (const [property, value] of Object.entries(declarations) as Array<
    [StylePropertyName, string]
  >) {
    const written = inlineVariableValue(value, variable);
    if (written !== value) changed = true;
    next[property] = written;
  }
  return changed ? next : declarations;
}

/** Styles with a variable written out wherever they use it; the same object when unused. */
export function inlineVariableInStyles<Styles extends AnyStyles>(
  styles: Styles,
  variable: DesignVariable,
): Styles {
  let changed = false;
  const next: Record<string, unknown> = {};
  for (const [key, declarations] of Object.entries(styles)) {
    if (key === "owners" && declarations) {
      const owners: Record<string, StyleDeclarations> = {};
      for (const [owner, owned] of Object.entries(
        declarations as Record<string, StyleDeclarations>,
      )) {
        owners[owner] = inlineDeclarations(owned, variable);
        if (owners[owner] !== owned) changed = true;
      }
      next[key] = owners;
    } else if (declarations) {
      const written = inlineDeclarations(declarations as StyleDeclarations, variable);
      if (written !== declarations) changed = true;
      next[key] = written;
    }
  }
  return changed ? (next as Styles) : styles;
}

/** The page with a variable written out on every element that uses it. */
export function inlineVariableOnPage(root: PageNode, variable: DesignVariable): PageNode {
  const visit = (node: PageNode): PageNode => {
    const children = node.children.map(visit);
    const styles = inlineVariableInStyles(node.styles, variable);
    const changedChildren = children.some((child, index) => child !== node.children[index]);
    if (styles === node.styles && !changedChildren) return node;
    return { ...node, styles, children: changedChildren ? children : node.children };
  };
  return visit(root);
}
