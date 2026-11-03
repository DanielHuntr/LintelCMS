import { z } from "zod";
import {
  type DesignVariable,
  designVariableSchema,
  maxDesignVariables,
} from "./design-variables.js";
import { maxSharedStyles, type SharedStyle, sharedStyleSchema } from "./shared-styles.js";
import { countVariablesInStyles, inlineVariableInStyles } from "./variable-uses.js";

/**
 * The site's design system as the builder edits it: its design variables and its shared
 * styles. Saved once for the whole site (core's `site-design/`), drawn into every page.
 */
export interface SiteDesign {
  variables: DesignVariable[];
  sharedStyles: SharedStyle[];
}

export const emptySiteDesign: SiteDesign = { variables: [], sharedStyles: [] };

const uniqueIds = <Item extends { id: string }>(items: readonly Item[]) =>
  new Set(items.map((item) => item.id)).size === items.length;

export const siteDesignSchema = z.object({
  variables: z
    .array(designVariableSchema)
    .max(maxDesignVariables, { error: `A site can have at most ${maxDesignVariables} variables` })
    .refine(uniqueIds, { error: "Two variables have the same id" })
    .default([]),
  sharedStyles: z
    .array(sharedStyleSchema)
    .max(maxSharedStyles, { error: `A site can have at most ${maxSharedStyles} shared styles` })
    .refine(uniqueIds, { error: "Two shared styles have the same id" })
    .default([]),
});

/** Shared styles by id, as pages are drawn with them. */
export function sharedStylesById(design: SiteDesign): Record<string, SharedStyle> {
  return Object.fromEntries(design.sharedStyles.map((style) => [style.id, style]));
}

/** How many styles in the site's design (its shared styles) name each variable. */
export function countVariableUsesInDesign(
  design: SiteDesign,
  into = new Map<string, number>(),
): Map<string, number> {
  for (const sharedStyle of design.sharedStyles) countVariablesInStyles(sharedStyle.styles, into);
  return into;
}

/**
 * The design without one variable. Shared styles that used it get its value written out, so
 * they look as they did.
 */
export function withoutVariable(design: SiteDesign, id: string): SiteDesign {
  const variable = design.variables.find((each) => each.id === id);
  if (!variable) return design;
  return {
    ...design,
    variables: design.variables.filter((each) => each.id !== id),
    sharedStyles: design.sharedStyles.map((sharedStyle) => {
      const styles = inlineVariableInStyles(sharedStyle.styles, variable);
      return styles === sharedStyle.styles ? sharedStyle : { ...sharedStyle, styles };
    }),
  };
}
