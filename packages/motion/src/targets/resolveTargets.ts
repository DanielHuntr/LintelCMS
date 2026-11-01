import type { Targets } from "../spec/motion.schema.js";
import { splitText } from "./splitText.js";

/**
 * Finds the elements an animation moves. The element the animation is attached to is the
 * "root": it is what triggers listen to, and the starting point for selectors and children.
 */

export interface ResolvedTargets {
  elements: HTMLElement[];
  /** Undoes anything resolving changed, such as splitting text. */
  restore(): void;
}

export interface ResolveOptions {
  /** The attribute the builder puts on every node, holding its id. */
  nodeAttribute: string;
}

function onlyHtmlElements(elements: Iterable<Element>): HTMLElement[] {
  return Array.from(elements).filter((element) => element instanceof HTMLElement);
}

function select(root: ParentNode, selector: string): Element[] {
  try {
    return Array.from(root.querySelectorAll(selector));
  } catch {
    // A selector typed by hand may not parse; that animates nothing rather than breaking the page.
    return [];
  }
}

function attributeSelector(attribute: string, value: string): string {
  return `[${attribute}="${value.replace(/["\\]/g, "\\$&")}"]`;
}

export function resolveTargets(
  root: HTMLElement,
  targets: Targets,
  options: ResolveOptions,
): ResolvedTargets {
  const nothingToRestore = () => undefined;
  switch (targets.type) {
    case "self":
      return { elements: [root], restore: nothingToRestore };
    case "children":
      return { elements: onlyHtmlElements(root.children), restore: nothingToRestore };
    case "selector":
      return {
        elements: onlyHtmlElements(select(root, targets.selector)),
        restore: nothingToRestore,
      };
    case "nodes": {
      const elements = targets.nodeIds.flatMap((nodeId) =>
        select(root.ownerDocument, attributeSelector(options.nodeAttribute, nodeId)),
      );
      return { elements: onlyHtmlElements(elements), restore: nothingToRestore };
    }
    case "text": {
      const split = splitText(root, targets.split);
      return { elements: split.pieces, restore: split.restore };
    }
  }
}
