import {
  type Breakpoint,
  type NodeStyles,
  type PageNode,
  readOwnerStateTarget,
  type StateTransition,
  type StyleDeclarations,
  type StyleState,
  type StyleTarget,
  type OwnerStateTarget,
} from "../document/page-document.schema.js";
import { makeCssSafeToEmbed } from "../code/sanitise-code.js";
import {
  compileMenuLinkRules,
  drawerLinkSelector,
  drawerMenuLinks,
} from "../menu-links/menu-links.js";
import { compileFontFaces, readPageFonts } from "../fonts/page-fonts.js";
import { impliedFreeLayoutStyles } from "../free-layout/free-layout.js";
import { impliedPlacedGridStyles } from "../placed-grid/placed-grid.js";
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
 * stacking on phones), a placed grid's columns (and its stacking on phones), a background
 * video's overlay, and the classes for styled parts of text (`.title-mark-1`). Hidden nodes
 * (and everything inside them) are left out, as they are from the HTML. Declarations are
 * always printed in the same order, so the same page gives the same CSS. Code blocks' own
 * CSS follows at the end, after a comment saying whose it is.
 *
 * States: a node's own hover, pressed and focus styles, and styles it takes while an element
 * around it (its owner, such as a card) is in a state: `.card:hover .picture`. An owner with a
 * state transition eases into its states, with everything that follows them, unless people
 * ask their device for less motion. The builder shows a state while it's being designed with
 * `compileStatePreview`.
 */
export function compileStylesheet(root: PageNode, classNames: ReadonlyMap<string, string>): string {
  const visible = listVisibleNodes(root);
  // A Menu link's look also goes to the links of Menu buttons' drawers near it.
  const drawers = drawerMenuLinks(root);
  const selectorsOf = (node: PageNode, className: string) => [
    `.${className}`,
    ...(drawers.get(node.id) ?? []).flatMap((drawerId) => {
      const drawerClass = classNames.get(drawerId);
      return drawerClass ? [drawerLinkSelector(drawerClass)] : [];
    }),
  ];
  const ruleFor = (
    node: PageNode,
    declarations: StyleDeclarations | undefined,
    suffix = "",
    indent = "",
  ) => {
    const className = classNames.get(node.id);
    return className && declarations
      ? formatRule(
          selectorsOf(node, className)
            .map((selector) => `${selector}${suffix}`)
            .join(",\n"),
          declarations,
          indent,
        )
      : null;
  };
  const styled = (entry: VisibleNode, breakpoint: Breakpoint) =>
    withImplied(entry.implied[breakpoint], entry.node.styles[breakpoint]);

  const sections: string[] = [];
  const fonts = root.type === "page" ? compileFontFaces(readPageFonts(root.props)) : "";
  if (fonts) sections.push(fonts);
  const base = visible.map((entry) => ruleFor(entry.node, styled(entry, "base")));
  const statePart = (className: string, state: StyleState) => [
    `.${className}${stateSelectors[state]}`,
  ];
  const states = visible.flatMap(({ node }) => {
    const className = classNames.get(node.id);
    if (!className) return [];
    const own = stateOrder.map((state) => ruleFor(node, node.styles[state], stateSelectors[state]));
    const owned = ownerTargets(node).map(({ target, state, ownerId }) => {
      const ownerClass = classNames.get(ownerId);
      const declarations = node.styles.owners?.[target];
      if (!ownerClass || !declarations) return null;
      const selector = statePart(ownerClass, state)
        .map((owner) => `${owner} .${className}`)
        .join(",\n");
      return formatRule(selector, declarations);
    });
    return [...own, ...owned];
  });
  const extras = visible.flatMap(({ node }) => extraRules(node, classNames.get(node.id)));
  const menuLinks = visible.flatMap(({ node }) => {
    const className = classNames.get(node.id);
    return node.type === "menuLink" && className
      ? [compileMenuLinkRules(node, selectorsOf(node, className), formatRule)]
      : [];
  });
  sections.push(
    ...compact([
      ...base,
      ...extras,
      ...menuLinks.flatMap((rules) => rules.early),
      ...states,
      ...menuLinks.flatMap((rules) => rules.late),
    ]),
  );
  const transitions = compileStateTransitions(
    visible.map(({ node }) => node),
    classNames,
  );
  if (transitions) sections.push(transitions);

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
      // Code CSS is typed by hand, so it mustn't be able to end the page's <style> early.
      const safeCss = makeCssSafeToEmbed(css.trim());
      sections.push(`/* Code: .${classNames.get(node.id) ?? node.id} */\n${safeCss}`);
    }
  }
  return sections.length === 0 ? "" : `${sections.join("\n\n")}\n`;
}

/**
 * For the builder's canvas: one owner's state shown as if it were happening (the card as when
 * hovered, with its picture grown), while that state is being styled. `target` is the state
 * being edited on the selected node: its own ("hover") or an owner's ("hover@n3").
 */
export function compileStatePreview(
  root: PageNode,
  classNames: ReadonlyMap<string, string>,
  selectedId: string,
  target: StyleTarget,
): string {
  const owner = readOwnerStateTarget(target);
  const state =
    owner?.state ?? (stateOrder.includes(target as StyleState) ? (target as StyleState) : null);
  if (!state) return "";
  const ownerId = owner?.ownerId ?? selectedId;
  const ownerClass = classNames.get(ownerId);
  if (!ownerClass) return "";
  const rules: Array<string | null> = [];
  const visit = (node: PageNode) => {
    const className = classNames.get(node.id);
    if (className && node.id === ownerId) {
      const own = node.styles[state];
      if (own) rules.push(formatRule(`.${ownerClass}`, own));
    } else if (className) {
      const declarations = node.styles.owners?.[`${state}@${ownerId}`];
      if (declarations) rules.push(formatRule(`.${ownerClass} .${className}`, declarations));
    }
    node.children.forEach(visit);
  };
  visit(root);
  return compact(rules).join("\n\n");
}

const stateOrder: readonly StyleState[] = ["hover", "pressed", "focus", "open", "selected"];

export const stateSelectors: Record<StyleState, string> = {
  hover: ":hover",
  pressed: ":active",
  focus: ":focus-visible",
  // Set by the site's elements script when the element's button opens it.
  open: "[data-open]",
  // What's already marked as current or chosen: no script needed.
  selected: ':is([aria-current="page"], [aria-selected="true"], [aria-pressed="true"])',
};

/**
 * The elements that open and close: those with open styles of their own, or that others
 * follow ("while the card is open"). On the website they carry `data-lintel-opens`, and the
 * elements script makes their button toggle them.
 */
export function listOpeningNodes(root: PageNode): Set<string> {
  const opening = new Set<string>();
  const visit = (node: PageNode) => {
    if (node.hidden) return;
    if (node.styles.open) opening.add(node.id);
    for (const target of Object.keys(node.styles.owners ?? {})) {
      const [state, ownerId] = target.split("@");
      if (state === "open" && ownerId) opening.add(ownerId);
    }
    node.children.forEach(visit);
  };
  visit(root);
  return opening;
}

function ownerTargets(node: PageNode) {
  return (Object.keys(node.styles.owners ?? {}) as OwnerStateTarget[]).flatMap((target) => {
    const parts = readOwnerStateTarget(target);
    return parts ? [{ target, ...parts }] : [];
  });
}

const transitionTimes: Record<StateTransition["speed"], number> = {
  quick: 180,
  steady: 320,
  slow: 560,
};

const transitionCurves: Record<StateTransition["feel"], string> = {
  smooth: "cubic-bezier(0.2, 0.8, 0.2, 1)",
  springy: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  instant: "linear",
};

/** The CSS properties a set of declarations sets, as printed. */
function cssNamesOf(declarations: StyleDeclarations | undefined): string[] {
  if (!declarations) return [];
  return stylePropertyNames.flatMap((property) => {
    if (declarations[property] === undefined) return [];
    const { cssName, alsoPrintedAs = [] } = styleProperties[property] as {
      cssName: string;
      alsoPrintedAs?: readonly string[];
    };
    return [...alsoPrintedAs, cssName];
  });
}

/**
 * Eases each owner with a state transition, and everything that follows its states, into and
 * out of them: only the properties its states change, and only for people who haven't asked
 * for less motion (they see the change straight away).
 */
function compileStateTransitions(
  nodes: readonly PageNode[],
  classNames: ReadonlyMap<string, string>,
): string | null {
  const owners = new Map(
    nodes.flatMap((node) =>
      node.stateTransition && node.stateTransition.feel !== "instant"
        ? [[node.id, node.stateTransition] as const]
        : [],
    ),
  );
  if (owners.size === 0) return null;
  const changed = new Map<string, { transition: StateTransition; names: Set<string> }>();
  const note = (nodeId: string, transition: StateTransition, names: readonly string[]) => {
    if (names.length === 0) return;
    const entry = changed.get(nodeId) ?? { transition, names: new Set<string>() };
    names.forEach((name) => entry.names.add(name));
    changed.set(nodeId, entry);
  };
  for (const node of nodes) {
    const own = owners.get(node.id);
    if (own)
      note(
        node.id,
        own,
        stateOrder.flatMap((state) => cssNamesOf(node.styles[state])),
      );
    for (const { target, ownerId } of ownerTargets(node)) {
      const transition = owners.get(ownerId);
      if (transition) note(node.id, transition, cssNamesOf(node.styles.owners?.[target]));
    }
  }
  const rules = nodes.flatMap((node) => {
    const entry = changed.get(node.id);
    const className = classNames.get(node.id);
    if (!entry || !className) return [];
    const time = transitionTimes[entry.transition.speed];
    const curve = transitionCurves[entry.transition.feel];
    const list = [...entry.names].map((name) => `${name} ${time}ms ${curve}`).join(", ");
    return [`  .${className} {\n    transition: ${list};\n  }`];
  });
  return rules.length === 0
    ? null
    : `@media (prefers-reduced-motion: no-preference) {\n${rules.join("\n\n")}\n}`;
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
    const implied = mergeImplied(
      impliedFreeLayoutStyles(node, parent),
      impliedPlacedGridStyles(node, parent),
    );
    if (node.backgroundVideo) {
      implied.base = { position: "relative", isolation: "isolate", ...implied.base };
    }
    nodes.push({ node, implied });
    node.children.forEach((child) => visit(child, node));
  };
  visit(root, null);
  return nodes;
}

/** Two sets of implied styles as one; the second wins where both set a property. */
function mergeImplied(
  first: Partial<NodeStyles>,
  second: Partial<NodeStyles>,
): Partial<NodeStyles> {
  const merged: Partial<NodeStyles> = { ...first };
  for (const breakpoint of ["base", "tablet", "phone"] as const) {
    const declarations = second[breakpoint];
    if (declarations) merged[breakpoint] = { ...merged[breakpoint], ...declarations };
  }
  return merged;
}

function compact<Value>(values: ReadonlyArray<Value | null>): Value[] {
  return values.filter((value): value is Value => value !== null);
}
