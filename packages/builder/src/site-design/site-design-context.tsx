import {
  type DesignToken,
  type DesignVariable,
  type DesignVariableKind,
  emptySiteDesign,
  newVariableId,
  type SharedStyle,
  type SiteDesign,
  type SiteDesignUses,
  variablesAsTokens,
} from "@lintel/builder-model";
import { createContext, useContext } from "react";

/**
 * The site's design system while a page is designed: its variables and shared styles, and
 * how to change them (left out for people who may only use them). Provided by the builder
 * from its `siteDesign` prop; the app saves each change.
 */
export interface SiteDesignTools {
  design: SiteDesign;
  change?: (next: SiteDesign) => void;
  /** The site's theme values by token name (`lintel-color-accent`), for previews. */
  themeValues?: ReadonlyMap<string, string>;
  /**
   * Where each variable and shared style is used on the rest of the site (other pages, the
   * navigation and footer when they aren't on screen, blocks), counted by the server.
   * Undefined until it has loaded.
   */
  uses?: SiteDesignUses;
}

export const SiteDesignContext = createContext<SiteDesignTools>({ design: emptySiteDesign });

export function useSiteDesign(): SiteDesignTools {
  return useContext(SiteDesignContext);
}

/** The site's own variables of one kind, as tokens for swatches and choices. */
export function useSiteTokens(kind: DesignVariableKind): DesignToken[] {
  return variablesAsTokens(useSiteDesign().design.variables, kind);
}

/** The design with one variable added, and that variable. */
export function addVariable(
  design: SiteDesign,
  kind: DesignVariableKind,
  name: string,
  value: string,
): { design: SiteDesign; variable: DesignVariable } {
  const variable: DesignVariable = {
    id: newVariableId(
      name,
      design.variables.map((each) => each.id),
    ),
    name: name.trim(),
    kind,
    value,
  };
  return { design: { ...design, variables: [...design.variables, variable] }, variable };
}

/** The design with one shared style replaced (matched by id). */
export function withSharedStyle(design: SiteDesign, sharedStyle: SharedStyle): SiteDesign {
  const exists = design.sharedStyles.some((each) => each.id === sharedStyle.id);
  return {
    ...design,
    sharedStyles: exists
      ? design.sharedStyles.map((each) => (each.id === sharedStyle.id ? sharedStyle : each))
      : [...design.sharedStyles, sharedStyle],
  };
}

/** An id for a new shared style from its name, unique on the site. */
export function newSharedStyleId(design: SiteDesign, name: string): string {
  return newVariableId(
    name,
    design.sharedStyles.map((each) => each.id),
  );
}
