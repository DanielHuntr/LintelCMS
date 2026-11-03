import { z } from "zod";
import {
  type DesignVariable,
  designVariableSchema,
  maxDesignVariables,
} from "./design-variables.js";
import { maxSharedStyles, type SharedStyle, sharedStyleSchema } from "./shared-styles.js";

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
