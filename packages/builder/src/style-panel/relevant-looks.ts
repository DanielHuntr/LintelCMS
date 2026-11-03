import type { PageNode } from "@lintel/builder-model";

/**
 * Which of the less common looks make sense for an element, so the simple style panel
 * doesn't offer "Open" and "Current" for every heading and box. Advanced shows them all.
 */
export interface RelevantLooks {
  /** It opens and closes (its button toggles it), or something around it does. */
  open: boolean;
  /** It can be the page you're on or the chosen tab: a link, a menu, tabs, or inside one. */
  selected: boolean;
}

/** Elements that open and close by their nature. */
const openingTypes: ReadonlySet<string> = new Set([
  "accordion",
  "accordionItem",
  "modal",
  "mobileMenu",
  "cartDrawer",
]);

/** Elements whose button can open them: a button, or one of these with a button in it. */
const buttonTypes: ReadonlySet<string> = new Set(["button", "magneticButton"]);

/** Elements that are marked as current or chosen on the website. */
const currentTypes: ReadonlySet<string> = new Set([
  "link",
  "navigation",
  "mobileMenu",
  "siteHeader",
  "breadcrumbs",
  "tabs",
  "tabPanel",
  "languageSwitcher",
]);

/** How deep inside an element a button still counts as its own (a card's "Read more"). */
const buttonDepth = 2;

function holdsButton(node: PageNode, depth: number): boolean {
  if (depth < 0) return false;
  return node.children.some(
    (child) => buttonTypes.has(child.type) || holdsButton(child, depth - 1),
  );
}

/** `path` runs from the page down to the element, as `findPath` gives it. */
export function relevantLooks(path: readonly PageNode[]): RelevantLooks {
  const node = path.at(-1);
  if (!node) return { open: false, selected: false };
  const around = path.slice(0, -1);
  const open =
    node.styles.open !== undefined ||
    openingTypes.has(node.type) ||
    buttonTypes.has(node.type) ||
    holdsButton(node, buttonDepth) ||
    around.some((each) => each.styles.open !== undefined || openingTypes.has(each.type));
  const selected =
    node.styles.selected !== undefined ||
    currentTypes.has(node.type) ||
    around.some((each) => currentTypes.has(each.type));
  return { open, selected };
}
