import {
  applyScriptRule,
  asSiteSection,
  createEmptyPage,
  createNode,
  createRandomNodeId,
  findChangedCode,
  findSectionTemplate,
  type NodeBlueprint,
  noSiteSections,
  type PageDocument,
  type PageNode,
  type SiteSections,
  type SiteSectionsChange,
  type SiteSectionSlot,
  siteSectionSlots,
  validatePageDocument,
} from "@lintel/builder-model";
import type { DatabaseOrTransaction } from "../database/client.js";
import { removeScriptsFromCodeHtml } from "../fieldtypes/code-html-cleaner.js";
import { pageComponentCatalogue } from "../pages/page-components.js";
import { readSetting } from "../settings/settings.service.js";
import { findOrCreateDefaultSite } from "../sites/sites.service.js";
import type { Site } from "../sites/sites.table.js";
import {
  SiteSectionCodeNotAllowedError,
  SiteSectionNotValidError,
} from "./site-sections.errors.js";
import {
  findStoredSiteSections,
  saveStoredSiteSections,
  saveStoredSiteSectionsIfMissing,
} from "./site-sections.repository.js";

/**
 * A site's navigation and footer: sections made in the page builder and shown on every page
 * of that site (see site-sections/ in @lintel/builder-model and docs/decisions/0039). Saved
 * once per site; pages only say whether they hide them. A site without a navigation keeps
 * the website's automatic header, and the same for the footer.
 */

/** One section as a page of its own, for checking it as pages are checked. */
function asPage(section: PageNode): PageDocument {
  const page = createEmptyPage();
  return { ...page, root: { ...page.root, children: [section] } };
}

/** A stored section, checked; null when it can't be read (it is then as if there were none). */
function readSection(value: unknown, slot: SiteSectionSlot): PageNode | null {
  if (value === null || value === undefined) return null;
  const checked = validatePageDocument(asPage(value as PageNode), pageComponentCatalogue);
  const section = checked.ok ? checked.document.root.children[0] : undefined;
  return section ? asSiteSection(section, slot) : null;
}

/** The site's sections, or none for a site that has never had any. */
export async function readSiteSections(
  database: DatabaseOrTransaction,
  site: Site,
): Promise<SiteSections> {
  const stored = await findStoredSiteSections(database, site.id);
  if (typeof stored !== "object" || stored === null) return noSiteSections;
  const values = stored as Record<string, unknown>;
  return {
    navigation: readSection(values.navigation, "navigation"),
    footer: readSection(values.footer, "footer"),
  };
}

/**
 * Changes some of the site's sections: each slot sent is replaced (null takes it off the
 * site, bringing back the automatic one), the others stay. Each is checked as a page is, the
 * site's rule for scripts is applied, and only people with `builder:code` may change code.
 */
export async function changeSiteSections(
  database: DatabaseOrTransaction,
  site: Site,
  change: SiteSectionsChange,
  rules: { mayEditCode: boolean },
): Promise<SiteSections> {
  const current = await readSiteSections(database, site);
  const scriptRule = await readSetting(database, "builderCustomScripts");
  const next: SiteSections = { ...current };
  for (const slot of siteSectionSlots) {
    const sent = change[slot];
    if (sent === undefined) continue;
    if (sent === null) {
      next[slot] = null;
      continue;
    }
    const checked = validatePageDocument(asPage(sent), pageComponentCatalogue);
    if (!checked.ok) {
      throw new SiteSectionNotValidError(slot, checked.problems[0]?.message ?? "");
    }
    const page = applyScriptRule(checked.document, scriptRule, removeScriptsFromCodeHtml);
    const previous = current[slot];
    if (
      !rules.mayEditCode &&
      findChangedCode(previous ? asPage(previous) : null, page, pageComponentCatalogue).length > 0
    ) {
      throw new SiteSectionCodeNotAllowedError();
    }
    const section = page.root.children[0];
    next[slot] = section ? asSiteSection(section, slot) : null;
  }
  await saveStoredSiteSections(database, site.id, next);
  return next;
}

/** A section made from a blueprint, with fresh ids, as one of the site's. */
function makeSection(blueprint: NodeBlueprint | undefined, slot: SiteSectionSlot): PageNode | null {
  return blueprint
    ? asSiteSection(createNode(blueprint, pageComponentCatalogue, createRandomNodeId), slot)
    : null;
}

/**
 * The sections a new site starts with, so nobody publishes a site with no menu: a starter
 * template's own, where it has them, else Logo and menu and the Centred footer.
 */
export function starterSiteSections(
  own: { navigation?: NodeBlueprint; footer?: NodeBlueprint } = {},
): SiteSections {
  return {
    navigation: makeSection(
      own.navigation ?? findSectionTemplate("navigation-logo-left")?.blueprint,
      "navigation",
    ),
    footer: makeSection(own.footer ?? findSectionTemplate("footer-centred")?.blueprint, "footer"),
  };
}

/**
 * A starter template's navigation and footer for a site: when the template's look is applied
 * they replace the site's (they are part of that look); otherwise the site gets them only
 * if it has never had sections of its own.
 */
export async function applyStarterSiteSections(
  database: DatabaseOrTransaction,
  site: Site,
  own: { navigation?: NodeBlueprint; footer?: NodeBlueprint } | undefined,
  replace: boolean,
): Promise<void> {
  const sections = starterSiteSections(own);
  if (replace) await saveStoredSiteSections(database, site.id, sections);
  else await saveStoredSiteSectionsIfMissing(database, site.id, sections);
}

/**
 * Gives a site its starter navigation and footer, unless it has ever had sections of its own
 * (then it keeps what it chose). For setup and starter templates. Returns whether it did.
 */
export async function ensureStarterSiteSections(
  database: DatabaseOrTransaction,
  site?: Site,
): Promise<boolean> {
  const target = site ?? (await findOrCreateDefaultSite(database));
  return saveStoredSiteSectionsIfMissing(database, target.id, starterSiteSections());
}
