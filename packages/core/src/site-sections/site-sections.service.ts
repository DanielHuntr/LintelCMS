import {
  applyScriptRule,
  asSiteSection,
  createEmptyPage,
  createNode,
  createRandomNodeId,
  findChangedCode,
  findSectionTemplate,
  footerCentred,
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
  NoPreviousSiteSectionsError,
  SiteSectionCodeNotAllowedError,
  SiteSectionNotValidError,
} from "./site-sections.errors.js";
import {
  deleteDraftSiteSections,
  findDraftSiteSections,
  findPreviousSiteSections,
  findStoredSiteSections,
  saveDraftSiteSections,
  savePreviousSiteSections,
  saveStoredSiteSections,
  saveStoredSiteSectionsIfMissing,
} from "./site-sections.repository.js";

/**
 * A site's navigation and footer: sections made in the page builder and shown on every page
 * of that site (see site-sections/ in @lintel/builder-model and docs/decisions/0039). Saved
 * once per site; pages only say whether they hide them. A site without a navigation keeps
 * the website's automatic header, and the same for the footer.
 *
 * Changes made in the builder wait as a draft until a page is published (or they are
 * published on their own), like a page's own changes: the website, Liquid templates and
 * everything else visitors see read the published sections (`readSiteSections`); the
 * builder reads and changes the draft (`readSiteSectionsDraft`, `changeSiteSections`).
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

/** The site's published sections, or none for a site that has never had any. */
export async function readSiteSections(
  database: DatabaseOrTransaction,
  site: Site,
): Promise<SiteSections> {
  return readStoredSections(await findStoredSiteSections(database, site.id));
}

/** The sections as the builder shows them, with whether that differs from the website. */
export interface SiteSectionsDraft extends SiteSections {
  /** There are changes to them that a publish would put on the website. */
  unpublished: boolean;
}

/** The sections being worked on: the draft when there is one, else the published ones. */
export async function readSiteSectionsDraft(
  database: DatabaseOrTransaction,
  site: Site,
): Promise<SiteSectionsDraft> {
  const draft = await findDraftSiteSections(database, site.id);
  const hasDraft = typeof draft === "object" && draft !== null;
  const sections = hasDraft ? readStoredSections(draft) : await readSiteSections(database, site);
  return { ...sections, unpublished: hasDraft };
}

/**
 * Puts the draft on the website. Returns whether there was one; with none, nothing changes.
 */
export async function publishSiteSections(
  database: DatabaseOrTransaction,
  site: Site,
): Promise<boolean> {
  const draft = await findDraftSiteSections(database, site.id);
  if (typeof draft !== "object" || draft === null) return false;
  await saveStoredSiteSections(database, site.id, draft);
  await deleteDraftSiteSections(database, site.id);
  return true;
}

function readStoredSections(stored: unknown): SiteSections {
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
): Promise<SiteSectionsDraft> {
  const draft = await readSiteSectionsDraft(database, site);
  const current: SiteSections = { navigation: draft.navigation, footer: draft.footer };
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
  // The draft is kept only while it differs from the website: changing a section back
  // leaves nothing to publish.
  const published = await readSiteSections(database, site);
  if (JSON.stringify(next) === JSON.stringify(published)) {
    await deleteDraftSiteSections(database, site.id);
    return { ...next, unpublished: false };
  }
  await saveDraftSiteSections(database, site.id, next);
  return { ...next, unpublished: true };
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
    // No small print to begin with: words that say "replace this" would go live with the site.
    footer: makeSection(own.footer ?? footerCentred({}), "footer"),
  };
}

/**
 * A starter template's navigation and footer for a site. With `replace` (the template's look
 * is applied to a site that keeps none of its own pages, by someone who may change blocks)
 * they take the place of the site's, and the site's are kept so they can be brought back
 * (`restorePreviousSiteSections`). Otherwise the site gets them only if it has never had
 * sections of its own, so adding a template beside the site's pages never changes its menu
 * or footer. Returns whether the site's own sections were set aside.
 */
export async function applyStarterSiteSections(
  database: DatabaseOrTransaction,
  site: Site,
  own: { navigation?: NodeBlueprint; footer?: NodeBlueprint } | undefined,
  replace: boolean,
): Promise<boolean> {
  const sections = starterSiteSections(own);
  if (!replace) {
    await saveStoredSiteSectionsIfMissing(database, site.id, sections);
    return false;
  }
  const stored = await findStoredSiteSections(database, site.id);
  const keptPrevious = typeof stored === "object" && stored !== null;
  if (keptPrevious) await savePreviousSiteSections(database, site.id, stored);
  await saveStoredSiteSections(database, site.id, sections);
  // The template's look goes on the website at once, so changes waiting to be published
  // would only bring the old ones back.
  await deleteDraftSiteSections(database, site.id);
  return keptPrevious;
}

/**
 * Brings back the navigation and footer a starter template replaced. The template's go where
 * the old ones were kept, so doing it again swaps them back.
 */
export async function restorePreviousSiteSections(
  database: DatabaseOrTransaction,
  site: Site,
): Promise<SiteSectionsDraft> {
  const previous = await findPreviousSiteSections(database, site.id);
  if (typeof previous !== "object" || previous === null) {
    throw new NoPreviousSiteSectionsError();
  }
  const current = await findStoredSiteSections(database, site.id);
  if (typeof current === "object" && current !== null) {
    await savePreviousSiteSections(database, site.id, current);
  }
  await saveStoredSiteSections(database, site.id, previous);
  await deleteDraftSiteSections(database, site.id);
  return readSiteSectionsDraft(database, site);
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
