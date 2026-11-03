import type { DesignVariable, StylePropertyName } from "@lintel/builder-model";
import { variablesIn } from "@lintel/builder-model";
import { useSiteDesign } from "../site-design/site-design-context.js";
import { useStyleReader } from "./style-field.js";
import type { ReadStyle } from "./style-summaries.js";

/**
 * A style reader for section summaries that says a site variable's name rather than its
 * code: `var(--lintel-var-ink)` reads as "Ink". `linked` says whether a summary used one,
 * so the section can show a small dot for it.
 */
export function namingVariables(
  read: ReadStyle,
  variables: readonly DesignVariable[],
): { read: ReadStyle; linked: () => boolean } {
  let linked = false;
  const byId = new Map(variables.map((variable) => [variable.id, variable.name]));
  return {
    read: (property: StylePropertyName) => {
      const value = read(property);
      const match = value?.match(/^var\(--lintel-var-([a-z][a-z0-9-]*)\)$/);
      if (!value || !match) return value;
      const name = byId.get(match[1] ?? "");
      if (!name) return value;
      linked = true;
      return name;
    },
    linked: () => linked,
  };
}

/** A section's summary, with the site's variables named, and whether one is linked. */
export function useStyleSummary(summarise: (read: ReadStyle) => string): {
  summary: string;
  linked: boolean;
} {
  const read = useStyleReader();
  const { design } = useSiteDesign();
  const naming = namingVariables(read, design.variables);
  const summary = summarise(naming.read);
  return { summary, linked: summary !== "" && naming.linked() };
}

/** Whether a value names one of the site's variables. */
export function isVariableValue(value: string | undefined): boolean {
  return value !== undefined && variablesIn(`${value} `).length > 0;
}
