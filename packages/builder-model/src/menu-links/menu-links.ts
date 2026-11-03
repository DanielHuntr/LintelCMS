import {
  menuItemIdSchema,
  menuLinkHoverLooks,
  type MenuLinkHoverLook,
} from "../components/site-navigation-components.js";
import {
  nodeStylesSchema,
  type NodeStyles,
  type PageNode,
  type StyleState,
} from "../document/page-document.schema.js";
import { breakpointWidths } from "../styles/style-cascade.js";
import { isSafeStyleValue } from "../styles/style-properties.js";

/**
 * A Menu's links are drawn by the Menu from the site's menu (or its own list), so they can't
 * be selected one by one. Instead a Menu holds one "Menu link": the look of every link in it.
 * People style it like any element (its Hovered and Current looks included), choose what a
 * link does on hover, and can change a few links on their own ("Only Contact"): those
 * changes are kept by menu item id and fall back to the shared look for everything else.
 *
 * Everything here is CSS. The links carry the Menu link's class and `data-menu-item`, so a
 * link's own look is `.menu-link[data-menu-item="…"]`. A Menu button's drawer in the same
 * part of the page takes the same look. Only the scramble needs a script, which the page
 * gets as an ordinary effect (see `impliedMenuLinkEffect`).
 */

/** The id a link is known by: its menu item's id, or its place for links without one. */
export function menuItemKey(id: string | undefined, index: number): string {
  return id && menuItemIdSchema.safeParse(id).success ? id : `link-${index + 1}`;
}

/** A Menu's Menu link, when it has one that isn't hidden. */
export function menuLinkOf(menu: PageNode): PageNode | undefined {
  return menu.children.find((child) => child.type === "menuLink" && !child.hidden);
}

/**
 * The page with a Menu link in every Menu that has none (menus made before they had one),
 * so the builder can show and select it. The same page comes back when nothing changed. A
 * Menu link with no styles draws the links exactly as before.
 */
export function withMenuLinks(root: PageNode, createId: () => string): PageNode {
  const visit = (node: PageNode): PageNode => {
    const children = node.children.map(visit);
    const changed = children.some((child, index) => child !== node.children[index]);
    const needsLink =
      node.type === "navigation" && !node.children.some((child) => child.type === "menuLink");
    if (!changed && !needsLink) return node;
    return {
      ...node,
      children: needsLink
        ? [
            ...children,
            {
              id: createId(),
              type: "menuLink",
              name: "",
              props: { hoverLook: "none", lookColour: "", keepOnCurrent: true, itemStyles: {} },
              styles: { base: {} },
              children: [],
              hidden: false,
              locked: false,
            },
          ]
        : children,
    };
  };
  return visit(root);
}

/**
 * Which Menu link each Menu button (its drawer) takes its look from: the first Menu found
 * looking outwards from the button, in the same row, then the same section, and so on.
 */
export function drawerMenuLinks(root: PageNode): Map<string, string[]> {
  const drawers = new Map<string, string[]>();
  const findMenuLink = (node: PageNode): PageNode | undefined => {
    if (node.hidden) return undefined;
    if (node.type === "navigation") return menuLinkOf(node);
    for (const child of node.children) {
      const found = findMenuLink(child);
      if (found) return found;
    }
    return undefined;
  };
  const visit = (node: PageNode, ancestors: PageNode[]) => {
    if (node.hidden) return;
    if (node.type === "mobileMenu") {
      for (const ancestor of [...ancestors].reverse()) {
        const menuLink = findMenuLink(ancestor);
        if (menuLink) {
          drawers.set(menuLink.id, [...(drawers.get(menuLink.id) ?? []), node.id]);
          break;
        }
      }
    }
    node.children.forEach((child) => visit(child, [...ancestors, node]));
  };
  visit(root, []);
  return drawers;
}

/** The selector for a drawer's own links, so they take a Menu link's look. */
export function drawerLinkSelector(drawerClass: string): string {
  return `.${drawerClass} .lintel-drawer__links > li > a`;
}

export interface MenuLinkSettings {
  hoverLook: MenuLinkHoverLook;
  colour: string;
  keepOnCurrent: boolean;
  itemStyles: Record<string, NodeStyles>;
}

/** A Menu link's settings, read carefully from its stored props. */
export function readMenuLinkSettings(props: Readonly<Record<string, unknown>>): MenuLinkSettings {
  const hoverLook = (menuLinkHoverLooks as readonly unknown[]).includes(props.hoverLook)
    ? (props.hoverLook as MenuLinkHoverLook)
    : "none";
  const colour =
    typeof props.lookColour === "string" &&
    props.lookColour.length <= 120 &&
    isSafeStyleValue(props.lookColour)
      ? props.lookColour.trim()
      : "";
  const itemStyles: Record<string, NodeStyles> = {};
  if (typeof props.itemStyles === "object" && props.itemStyles !== null) {
    for (const [id, styles] of Object.entries(props.itemStyles)) {
      const parsed = nodeStylesSchema.safeParse(styles);
      if (menuItemIdSchema.safeParse(id).success && parsed.success) {
        itemStyles[id] = parsed.data as NodeStyles;
      }
    }
  }
  return { hoverLook, colour, keepOnCurrent: props.keepOnCurrent !== false, itemStyles };
}

/** The effect the page runs for a Menu link that scrambles on hover; undefined for others. */
export function impliedMenuLinkEffect(
  node: PageNode,
): { effect: string; params: Record<string, number> } | undefined {
  if (node.type !== "menuLink" || node.hidden) return undefined;
  return readMenuLinkSettings(node.props).hoverLook === "scramble"
    ? { effect: "scramble-on-hover", params: { duration: 450 } }
    : undefined;
}

const currentSelector = '[aria-current="page"]';
const easing = "cubic-bezier(.2, .8, .2, 1)";

/** `S` once for every selector: `.a:hover::after, .b:hover::after`. */
function each(selectors: readonly string[], suffix: string): string {
  return selectors.map((selector) => `${selector}${suffix}`).join(",\n");
}

function rule(selector: string, body: string, indent = ""): string {
  const lines = body
    .split(";")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `${indent}  ${line};`);
  return `${indent}${selector} {\n${lines.join("\n")}\n${indent}}`;
}

function media(query: string, rules: readonly string[]): string {
  const indented = rules.map((text) =>
    text
      .split("\n")
      .map((line) => `  ${line}`)
      .join("\n"),
  );
  return `@media ${query} {\n${indented.join("\n\n")}\n}`;
}

/**
 * The rules for a hover look: how it rests, and how it looks while the pointer is over a
 * link (only on devices that can hover), while a link has keyboard focus, and on the current
 * page's link when it's kept there. With less motion the change is instant, and the words
 * don't roll.
 *
 * A drawer's links are whole rows, so a line or circle drawn around one would cross the
 * drawer: there the current page's link (and a focused one) is underlined instead, and the
 * colour fade is the same as in the menu.
 */
function hoverLookRules(
  settings: MenuLinkSettings,
  [own, ...drawers]: readonly string[],
): string[] {
  const { hoverLook, keepOnCurrent } = settings;
  if (hoverLook === "none" || hoverLook === "scramble" || own === undefined) return [];
  const colour = settings.colour || (hoverLook === "colour" ? "var(--lintel-color-brand)" : "");
  if (hoverLook === "colour") {
    return drawnLookRules(settings, [own, ...drawers], colour);
  }
  const drawerMarks =
    drawers.length === 0 || hoverLook === "rollUp"
      ? []
      : [
          rule(
            [
              each(drawers, ":focus-visible"),
              ...(keepOnCurrent ? [each(drawers, currentSelector)] : []),
            ].join(",\n"),
            `text-decoration-line: underline; text-decoration-thickness: 1px; text-underline-offset: 0.35em; text-decoration-color: ${colour || "currentColor"}`,
          ),
        ];
  return [...drawnLookRules(settings, [own], colour), ...drawerMarks];
}

function drawnLookRules(
  settings: MenuLinkSettings,
  selectors: readonly string[],
  colour: string,
): string[] {
  const { hoverLook, keepOnCurrent } = settings;
  const where = selectors.map((selector) => `:where(${selector})`);
  const shown = (suffix: string, body: string, includeCurrent = keepOnCurrent): string[] => {
    const hover = rule(each(selectors, `:hover${suffix}`), body);
    const focus = rule(each(selectors, `:focus-visible${suffix}`), body);
    const current = includeCurrent
      ? [rule(each(selectors, `${currentSelector}${suffix}`), body)]
      : [];
    return [media("(hover: hover)", [hover]), focus, ...current];
  };
  const stillForLessMotion = (suffix: string) =>
    media("(prefers-reduced-motion: reduce)", [rule(each(where, suffix), "transition: none")]);

  switch (hoverLook) {
    case "underline":
      return [
        rule(each(where, ""), "position: relative"),
        rule(
          each(where, "::after"),
          `content: ""; position: absolute; left: 0; right: 0; bottom: -0.2em; height: 1px; background: ${colour || "currentColor"}; transform: scaleX(0); transform-origin: right; transition: transform 0.4s ${easing}; pointer-events: none`,
        ),
        ...shown("::after", "transform: scaleX(1); transform-origin: left"),
        stillForLessMotion("::after"),
      ];
    case "circle":
      return [
        rule(each(where, ""), "position: relative; isolation: isolate"),
        rule(
          each(where, "::before"),
          `content: ""; position: absolute; inset: -0.35em -0.6em; border: 1px solid ${colour || "currentColor"}; border-radius: 50%; opacity: 0; transform: scale(0.85); transition: opacity 0.3s ease, transform 0.45s ${easing}; pointer-events: none; z-index: -1`,
        ),
        ...shown("::before", "opacity: 1; transform: none"),
        stillForLessMotion("::before"),
      ];
    case "colour":
      return [
        rule(each(where, ""), "transition: color 0.3s ease"),
        ...shown("", `color: ${colour}`),
        stillForLessMotion(""),
      ];
    case "rollUp": {
      const roll = (suffix: string) => [
        rule(each(selectors, `${suffix} .lintel-roll__words`), "transform: translateY(-100%)"),
        rule(each(selectors, `${suffix} .lintel-roll__copy`), "transform: none"),
      ];
      return [
        rule(
          each(where, " .lintel-roll"),
          "display: inline-grid; overflow: hidden; line-height: inherit",
        ),
        rule(
          each(where, " .lintel-roll > span"),
          `grid-area: 1 / 1; white-space: nowrap; transition: transform 0.45s cubic-bezier(.65, 0, .35, 1)`,
        ),
        rule(each(where, " .lintel-roll__copy"), "transform: translateY(100%)"),
        media("(hover: hover) and (prefers-reduced-motion: no-preference)", roll(":hover")),
        media("(prefers-reduced-motion: no-preference)", roll(":focus-visible")),
      ];
    }
    default:
      return [];
  }
}

const stateSuffixes: Record<StyleState, string> = {
  hover: ":hover",
  pressed: ":active",
  focus: ":focus-visible",
  open: "[data-open]",
  selected: currentSelector,
};

type FormatRule = (
  selector: string,
  declarations: NonNullable<NodeStyles["base"]>,
  indent?: string,
) => string | null;

/**
 * Links changed on their own: each one's look over the shared one, for its own resting look
 * (written before the shared Hovered and Current looks, so those still show on it), its
 * states and smaller screens.
 */
function itemRules(
  settings: MenuLinkSettings,
  selectors: readonly string[],
  formatRule: FormatRule,
): { resting: string[]; states: string[]; screens: Record<"tablet" | "phone", string[]> } {
  const resting: string[] = [];
  const states: string[] = [];
  const screens: Record<"tablet" | "phone", string[]> = { tablet: [], phone: [] };
  for (const [id, styles] of Object.entries(settings.itemStyles)) {
    const item = selectors.map((selector) => `${selector}[data-menu-item="${id}"]`);
    const base = formatRule(each(item, ""), styles.base ?? {});
    if (base) resting.push(base);
    for (const [state, suffix] of Object.entries(stateSuffixes) as Array<[StyleState, string]>) {
      const declarations = styles[state];
      const written = declarations && formatRule(each(item, suffix), declarations);
      if (written) states.push(written);
    }
    for (const screen of ["tablet", "phone"] as const) {
      const declarations = styles[screen];
      const written = declarations && formatRule(each(item, ""), declarations, "  ");
      if (written) screens[screen].push(written);
    }
  }
  return { resting, states, screens };
}

/**
 * Everything a Menu link adds to the page's CSS beyond its own styles: its hover look and
 * the looks of links changed on their own. `selectors` are its class and its drawers' links.
 */
export function compileMenuLinkRules(
  node: PageNode,
  selectors: readonly string[],
  formatRule: FormatRule,
): { early: string[]; late: string[] } {
  const settings = readMenuLinkSettings(node.props);
  const items = itemRules(settings, selectors, formatRule);
  const late = [...items.states];
  for (const screen of ["tablet", "phone"] as const) {
    if (items.screens[screen].length > 0) {
      late.push(
        `@media (max-width: ${breakpointWidths[screen]}px) {\n${items.screens[screen].join("\n\n")}\n}`,
      );
    }
  }
  return { early: [...hoverLookRules(settings, selectors), ...items.resting], late };
}
