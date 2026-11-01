import type { ComponentCatalogue } from "../components/component-catalogue.js";
import type { PageNode } from "../document/page-document.schema.js";
import { walkNodes } from "../tree/tree-queries.js";

/**
 * Every node gets one class, named after its layer: a node called "Hero" is `.hero`, an
 * unnamed heading is `.heading`. When names repeat, the later ones get a number in page order
 * (`.heading-2`, `.heading-3`), so the same page always gets the same names.
 *
 * Names are worked out when the page is drawn rather than stored. Renaming a layer is the way
 * to give an element a class name that stays put while things around it change.
 */
export function assignClassNames(
  root: PageNode,
  catalogue: ComponentCatalogue,
): Map<string, string> {
  const classNames = new Map<string, string>();
  const used = new Map<string, number>();

  walkNodes(root, (node) => {
    const base = classNameBase(node, catalogue);
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    classNames.set(node.id, count === 1 ? base : `${base}-${count}`);
  });
  return classNames;
}

function classNameBase(node: PageNode, catalogue: ComponentCatalogue): string {
  const label = node.name.trim() || catalogue.find(node.type)?.label || node.type;
  return slugifyClassName(label);
}

/** "Hero image" becomes "hero-image"; anything that isn't a letter or digit becomes a hyphen. */
export function slugifyClassName(text: string): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  if (slug === "") return "element";
  // A class can't start with a digit without escaping, so "2 columns" becomes "el-2-columns".
  return /^[0-9]/.test(slug) ? `el-${slug}` : slug;
}
