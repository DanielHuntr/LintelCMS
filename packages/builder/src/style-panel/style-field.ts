import {
  type Breakpoint,
  isOwnerStateTarget,
  isSafeValueFor,
  isSetAt,
  type NodeStyles,
  resolveStyle,
  type StylePropertyName,
  type StyleState,
  type StyleTarget,
} from "@lintel/builder-model";
import { createContext, useContext } from "react";
import type { BuilderStringKey } from "../i18n/builder-strings.js";

/**
 * What every style control needs: the selected element's styles, where edits go (a screen
 * size or a state) and how to change them. Provided once by the Style panel.
 */
export interface StyleEditing {
  styles: NodeStyles;
  target: StyleTarget;
  /** Sets or (with undefined) clears values at the current target; `label` names the change. */
  change: (values: Partial<Record<StylePropertyName, string | undefined>>, label: string) => void;
}

export const StyleEditingContext = createContext<StyleEditing | null>(null);

export function useStyleEditing(): StyleEditing {
  const editing = useContext(StyleEditingContext);
  if (!editing) throw new Error("Style controls need the Style panel around them.");
  return editing;
}

/** Reads any property's value in effect at the current target, for section summaries. */
export function useStyleReader(): (property: StylePropertyName) => string | undefined {
  const { styles, target } = useStyleEditing();
  return (property) => resolveStyle(styles, target, property).value;
}

export interface StyleField {
  /** The value in effect at the current target, from wherever it cascades. */
  value: string | undefined;
  /** Set here rather than inherited, at a screen size other than desktop or in a state. */
  isOverridden: boolean;
  set: (value: string | undefined) => void;
  reset: () => void;
}

export function useStyleField(property: StylePropertyName, label: string): StyleField {
  const { styles, target, change } = useStyleEditing();
  return {
    value: resolveStyle(styles, target, property).value,
    isOverridden: target !== "base" && isSetAt(styles, target, property),
    set: (value) => change({ [property]: value }, label),
    reset: () => change({ [property]: undefined }, label),
  };
}

const overrideNotes: Record<Breakpoint | StyleState, BuilderStringKey> = {
  base: "pageBuilder.style.changedHere",
  tablet: "pageBuilder.style.changedForTablet",
  phone: "pageBuilder.style.changedForPhone",
  hover: "pageBuilder.style.changedForHover",
  pressed: "pageBuilder.style.changedForPressed",
  focus: "pageBuilder.style.changedForFocus",
};

/** Where the dot's note comes from: "Changed for tablet" and the like. */
export function overrideNoteFor(target: StyleTarget): BuilderStringKey {
  return isOwnerStateTarget(target)
    ? "pageBuilder.style.changedForOwnerState"
    : overrideNotes[target];
}

const unitless = new Set<StylePropertyName>([
  "fontWeight",
  "lineHeight",
  "opacity",
  "zIndex",
  "order",
  "flexGrow",
  "flexShrink",
  "scale",
]);

/**
 * Tidies what someone typed: a bare number becomes pixels for lengths ("16" → "16px"), and
 * empty means "not set". Returns null when the value can't be used.
 */
export function normaliseTypedValue(
  property: StylePropertyName,
  typed: string,
): string | undefined | null {
  const trimmed = typed.trim();
  if (trimmed === "") return undefined;
  const value =
    /^-?\d+(\.\d+)?$/.test(trimmed) && !unitless.has(property) && trimmed !== "0"
      ? `${trimmed}px`
      : trimmed;
  return isSafeValueFor(property, value) ? value : null;
}
