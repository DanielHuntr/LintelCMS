import { countVariablesInStyles } from "./variable-uses.js";

/** How often one variable or shared style is used, and on how many pages. */
export interface DesignUse {
  /** Every use: styles on pages, in the site's navigation and footer, and in blocks. */
  uses: number;
  /** The pages with at least one. */
  pages: number;
}

/**
 * Where the site's variables and shared styles are used across the whole site, by id, as the
 * server counts them (GET /website/design/uses). The page being designed is usually left
 * out, since the builder counts it as it changes.
 */
export interface SiteDesignUses {
  variables: Record<string, DesignUse>;
  sharedStyles: Record<string, DesignUse>;
}

export const noSiteDesignUses: SiteDesignUses = { variables: {}, sharedStyles: {} };

/** What one place (a page, a section, a block) holds of each: counts by id. */
export interface DesignUseCounts {
  variables: Map<string, number>;
  sharedStyles: Map<string, number>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Counts the variables and shared styles used by every element found anywhere in a value: a
 * page's saved values (its design may be in any field), a section or a block's design. An
 * element is anything with `styles` and `children`, as page nodes have.
 */
export function countDesignUsesIn(value: unknown): DesignUseCounts {
  const counts: DesignUseCounts = { variables: new Map(), sharedStyles: new Map() };
  const visit = (current: unknown) => {
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (!isRecord(current)) return;
    if (isRecord(current.styles) && Array.isArray(current.children)) {
      countVariablesInStyles(
        current.styles as Parameters<typeof countVariablesInStyles>[0],
        counts.variables,
      );
      if (typeof current.sharedStyle === "string") {
        const id = current.sharedStyle;
        counts.sharedStyles.set(id, (counts.sharedStyles.get(id) ?? 0) + 1);
      }
    }
    for (const [key, inner] of Object.entries(current)) if (key !== "styles") visit(inner);
  };
  visit(value);
  return counts;
}

/** Adds one place's counts to the site's; `isPage` says whether it counts as a page. */
export function addDesignUses(total: SiteDesignUses, counts: DesignUseCounts, isPage: boolean) {
  const add = (into: Record<string, DesignUse>, from: Map<string, number>) => {
    for (const [id, uses] of from) {
      const current = into[id] ?? { uses: 0, pages: 0 };
      into[id] = { uses: current.uses + uses, pages: current.pages + (isPage ? 1 : 0) };
    }
  };
  add(total.variables, counts.variables);
  add(total.sharedStyles, counts.sharedStyles);
  return total;
}
