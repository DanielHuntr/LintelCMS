import type {
  Breakpoint,
  NodeStyles,
  StyleDeclarations,
  StyleTarget,
} from "../document/page-document.schema.js";
import type { StylePropertyName } from "./style-properties.js";

/**
 * How styles cascade down the screen sizes: desktop ("base") applies everywhere, tablet
 * changes it below tablet width, phone changes that again below phone width. So the value a
 * phone sees is phone's own, or else tablet's, or else desktop's.
 */

/** Where each breakpoint starts, as `max-width` media queries in the stylesheet. */
export const breakpointWidths: Record<Exclude<Breakpoint, "base">, number> = {
  tablet: 991,
  phone: 767,
};

/** The breakpoints a value can come from at `breakpoint`, nearest first. */
function cascadeFrom(breakpoint: Breakpoint): Breakpoint[] {
  if (breakpoint === "phone") return ["phone", "tablet", "base"];
  if (breakpoint === "tablet") return ["tablet", "base"];
  return ["base"];
}

export interface ResolvedStyle {
  value: string | undefined;
  /** Where the value was set; undefined when it isn't set anywhere. */
  setAt: StyleTarget | undefined;
}

/**
 * The value a property has at a breakpoint, or in a state (hover, focus), and where it came
 * from. A state falls back to the desktop value, since states apply at every size.
 */
export function resolveStyle(
  styles: NodeStyles,
  target: StyleTarget,
  property: StylePropertyName,
): ResolvedStyle {
  const sources: StyleTarget[] =
    target === "hover" || target === "focus" ? [target, "base"] : cascadeFrom(target);
  for (const source of sources) {
    const value = styles[source]?.[property];
    if (value !== undefined) return { value, setAt: source };
  }
  return { value: undefined, setAt: undefined };
}

/** Whether the property is set at exactly this target, rather than inherited. */
export function isSetAt(
  styles: NodeStyles,
  target: StyleTarget,
  property: StylePropertyName,
): boolean {
  return styles[target]?.[property] !== undefined;
}

/**
 * Sets (or, with undefined or "", clears) one property at one target. An emptied target is
 * dropped, so stored pages carry no `"tablet": {}` noise.
 */
export function setStyle(
  styles: NodeStyles,
  target: StyleTarget,
  property: StylePropertyName,
  value: string | undefined,
): NodeStyles {
  const current: StyleDeclarations = { ...(styles[target] ?? {}) };
  if (value === undefined || value.trim() === "") {
    delete current[property];
  } else {
    current[property] = value.trim();
  }
  return withTarget(styles, target, current);
}

/** Sets several properties at once, such as all four sides of padding. */
export function setStyles(
  styles: NodeStyles,
  target: StyleTarget,
  values: Partial<Record<StylePropertyName, string | undefined>>,
): NodeStyles {
  let next = styles;
  for (const [property, value] of Object.entries(values) as Array<
    [StylePropertyName, string | undefined]
  >) {
    next = setStyle(next, target, property, value);
  }
  return next;
}

function withTarget(
  styles: NodeStyles,
  target: StyleTarget,
  declarations: StyleDeclarations,
): NodeStyles {
  if (target === "base") return { ...styles, base: declarations };
  const next: NodeStyles = { ...styles };
  if (Object.keys(declarations).length === 0) {
    delete next[target];
  } else {
    next[target] = declarations;
  }
  return next;
}

/** The properties changed at a breakpoint or state, for the dots in the style panel. */
export function overriddenProperties(styles: NodeStyles, target: StyleTarget): StylePropertyName[] {
  if (target === "base") return [];
  return Object.keys(styles[target] ?? {}) as StylePropertyName[];
}
