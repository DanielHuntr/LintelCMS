import { randomUUID } from "node:crypto";
import {
  buildStarterPage,
  createRandomNodeId,
  findStarterSite,
  formsUsedBy,
  type StarterPageOptions,
  type StarterPage,
  type StarterSite,
} from "@lintel/builder-model";
import type { SiteTemplate } from "@lintel/site-components";
import { PermissionDeniedError } from "../auth/auth.errors.js";
import { findCollectionOrFail } from "../collections/collections.service.js";
import { ensurePagesCollection, pagesCollection } from "../collections/default-collections.js";
import { listSiteStarts } from "../content-roots/content-roots.service.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { AddressTakenError } from "../entries/entries.errors.js";
import { createEntry, type EntryChangeContext } from "../entries/entries.service.js";
import type { EntryResponse } from "../entries/entries.schema.js";
import { publishEntry } from "../entries/entry-publishing.service.js";
import { InvalidFieldsError } from "../http/http-errors.js";
import { mainMenu } from "../navigation/default-navigation.js";
import { linkedEntryIds } from "../navigation/navigation-items.js";
import type { NavigationResponse } from "../navigation/navigation.schema.js";
import { findNavigation, updateNavigation } from "../navigation/navigation.service.js";
import { NavigationNotFoundError } from "../navigation/navigation.errors.js";
import { removePageItems } from "../navigation/page-menu-items.js";
import { pageComponentCatalogue } from "../pages/page-components.js";
import { createForm, listForms } from "../forms/forms.service.js";
import { type FormTemplateId, formTemplateIds } from "../forms/form-templates.js";
import { findEnabledPluginIds } from "../plugins/plugins.service.js";
import { moveToRecycleBin } from "../recycle-bin/recycle-bin.service.js";
import { hasPermission } from "../roles/permissions.js";
import { readSiteEffects, updateSiteEffects } from "../site-effects/site-effects.service.js";
import { siteOrDefault } from "../sites/sites.service.js";
import type { Site } from "../sites/sites.table.js";
import { updateWebsiteRequestSchema } from "../website/website.schema.js";
import { updateWebsite } from "../website/website.service.js";
import { SiteHasPagesError, StarterSiteNotFoundError } from "./starter-sites.errors.js";
import { listCollectionPages } from "./starter-sites.repository.js";
import type {
  AppliedStarterPage,
  AppliedStarterSiteResponse,
  ApplyStarterSiteRequest,
  ExistingPagesResponse,
} from "./starter-sites.schema.js";

/**
 * "Start from a template": makes one page in Pages for each of the template's pages, with
 * its design, title and summary, through the entries service (so every page is checked and
 * gets a revision like any other save). The template's home page starts the page tree and
 * the others go under it ("/about"). Then, as far as the person is allowed:
 *
 *   - the website takes the template's colours, fonts and corners (settings:update);
 *   - the pages are published (entries:publish), otherwise they wait as drafts;
 *   - an empty main menu gets a link to each page; a menu with links is left alone, and the
 *     admin offers to add them (`addPagesToMainMenu`).
 *
 * A site with pages already is asked first (`existingPages`): replace them (they go to the
 * recycle bin) or add the template's beside them, without a second home page and with
 * "About (2)" where an address is taken. A site never gets two pages at one address.
 * Everything happens on the site the editor is working on.
 */

export interface StarterSiteContext extends EntryChangeContext {
  permissions: readonly string[];
  /** Who is starting from the template, for forms made for it. */
  authorEmail?: string;
  /** The site the editor is working on; its Pages and main menu get the template. */
  site?: Site | undefined;
  templates: readonly SiteTemplate[];
  builtInSiteUrl: string | null;
}

export async function applyStarterSite(
  database: DatabaseOrTransaction,
  starterSiteId: string,
  request: ApplyStarterSiteRequest,
  context: StarterSiteContext,
): Promise<AppliedStarterSiteResponse> {
  const site = findStarterSite(starterSiteId);
  if (!site) {
    throw new StarterSiteNotFoundError(starterSiteId);
  }
  await ensurePagesCollection(database);
  const editingSite = await siteOrDefault(database, context.site);
  const existing = await readExistingPages(database, editingSite);
  if (existing.pages.length > 0 && request.existingPages === "ask") {
    throw new SiteHasPagesError(existing.pages.length);
  }
  const isReplacing = request.existingPages === "replace" && existing.pages.length > 0;
  if (isReplacing && !hasPermission(context.permissions, "entries:delete")) {
    throw new PermissionDeniedError("entries:delete");
  }
  const replaced = isReplacing ? await replacePages(database, existing, context) : [];
  const keptHome = isReplacing ? null : existing.homeId;

  const enabledPlugins = await findEnabledPluginIds(database);
  const forms = enabledPlugins.includes("forms")
    ? await ensureTemplateForms(database, site, context)
    : {};
  const mayPublish = request.publish && hasPermission(context.permissions, "entries:publish");
  const [homePage, ...otherPages] = arrangeHomeFirst(site.pages);
  const pages: AppliedStarterPage[] = [];
  // Beside pages that were there, the site's own home page stays, and the others go under it.
  let parentId = keptHome;
  for (const page of keptHome === null ? [homePage, ...otherPages] : otherPages) {
    if (!page) continue;
    const isHome = page === homePage;
    const created = await createStarterPage(database, page, context, editingSite, {
      parentId: isHome ? null : parentId,
      renameWhenTaken: existing.pages.length > 0 && !isReplacing,
      options: { enabledPlugins, forms },
    });
    if (isHome) parentId = created.id;
    const published = mayPublish ? await publishEntry(database, created.id, context) : created;
    pages.push({
      entryId: created.id,
      title: textOf(created.data.title) || page.title,
      slug: created.slug,
      wantedSlug: page.slug,
      published: published.status === "published",
    });
  }
  const themeApplied =
    request.useTheme && hasPermission(context.permissions, "settings:update")
      ? await applyTheme(database, site, context)
      : false;
  const menu = hasPermission(context.permissions, "navigation:update")
    ? await fillEmptyMainMenu(database, pages, editingSite, replaced)
    : "left";
  return {
    starterSiteId: site.id,
    pages,
    themeApplied,
    menuFilled: menu === "filled",
    menuHasLinks: menu === "hasLinks",
    skippedHome: keptHome !== null,
    replacedCount: replaced.length,
  };
}

/** What a template would meet on the site: its pages, its home page, and taken addresses. */
export async function findExistingPages(
  database: DatabaseOrTransaction,
  starterSiteId: string,
  forSite: Site | undefined,
): Promise<ExistingPagesResponse> {
  const site = findStarterSite(starterSiteId);
  if (!site) {
    throw new StarterSiteNotFoundError(starterSiteId);
  }
  await ensurePagesCollection(database);
  const existing = await readExistingPages(database, await siteOrDefault(database, forSite));
  const bySlug = new Map(existing.pages.map((page) => [page.slug, page]));
  return {
    pageCount: existing.pages.length,
    hasHome: existing.homeId !== null,
    clashes: site.pages.flatMap((page) => {
      const taken = bySlug.get(page.slug);
      return taken
        ? [{ title: page.title, slug: page.slug, existingTitle: taken.title ?? "" }]
        : [];
    }),
  };
}

interface ExistingPages {
  pages: { id: string; slug: string; parentId: string | null; title: string | null }[];
  /** The page tree's start ("/"), when the site has one. */
  homeId: string | null;
}

async function readExistingPages(
  database: DatabaseOrTransaction,
  site: Site,
): Promise<ExistingPages> {
  const collection = await findCollectionOrFail(database, pagesCollection.handle, site);
  const pages = await listCollectionPages(database, collection.id, site.id, site.locale);
  const starts = await listSiteStarts(database, site.id, site.locale);
  const home = starts.find((start) => start.isDefault) ?? starts[0];
  return { pages, homeId: home?.entryId ?? null };
}

/** "Replace my pages": every page at the top goes to the recycle bin, with all under it. */
async function replacePages(
  database: DatabaseOrTransaction,
  existing: ExistingPages,
  context: StarterSiteContext,
): Promise<string[]> {
  const binned: string[] = [];
  for (const page of existing.pages.filter((candidate) => candidate.parentId === null)) {
    binned.push(...(await moveToRecycleBin(database, page.id, context.authorId)).entryIds);
  }
  return binned;
}

/** The template's home page first: the one at "home", else its first page. */
function arrangeHomeFirst(pages: readonly StarterPage[]): StarterPage[] {
  const home = pages.find((page) => page.slug === "home") ?? pages[0];
  return home ? [home, ...pages.filter((page) => page !== home)] : [];
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * The page at the template's address. Beside pages that were there, one whose address is
 * taken gets the next free one and says so in its title ("About (2)" at "/about-2"), so
 * nobody mistakes one page for the other; otherwise only the address changes ("menu-2").
 */
async function createStarterPage(
  database: DatabaseOrTransaction,
  page: StarterPage,
  context: EntryChangeContext,
  site: Site,
  placing: { parentId: string | null; renameWhenTaken: boolean; options: StarterPageOptions },
): Promise<EntryResponse> {
  const design = buildStarterPage(
    page,
    pageComponentCatalogue,
    createRandomNodeId,
    placing.options,
  );
  for (let attempt = 1; ; attempt += 1) {
    const slug = attempt === 1 ? page.slug : `${page.slug}-${attempt}`;
    const title =
      attempt > 1 && placing.renameWhenTaken ? `${page.title} (${attempt})` : page.title;
    try {
      return await createEntry(
        database,
        pagesCollection.handle,
        { data: { title, summary: page.summary, design }, slug, parentId: placing.parentId },
        context,
        site,
      );
    } catch (error) {
      const isAddressTaken =
        (error instanceof InvalidFieldsError || error instanceof AddressTakenError) && attempt < 20;
      if (!isAddressTaken) {
        throw error;
      }
    }
  }
}

/**
 * The forms a template's pages show (a contact form, say), made from Forms' template of the
 * same name when the site has no form with that handle yet, so the page has a working form
 * straight away. Answers the template's handle → the form's handle.
 */
async function ensureTemplateForms(
  database: DatabaseOrTransaction,
  site: StarterSite,
  context: StarterSiteContext,
): Promise<Record<string, string>> {
  const wanted = [...new Set(site.pages.flatMap((page) => formsUsedBy(page)))];
  if (wanted.length === 0) return {};
  const existing = new Set((await listForms(database)).forms.map((form) => form.handle));
  const handles: Record<string, string> = {};
  for (const handle of wanted) {
    if (!existing.has(handle)) {
      if (!context.authorId || !hasPermission(context.permissions, "forms:update")) continue;
      const template = (formTemplateIds as readonly string[]).includes(handle)
        ? (handle as FormTemplateId)
        : "blank";
      await createForm(
        database,
        { name: "Contact", handle, template },
        { id: context.authorId, email: context.authorEmail ?? "" },
      );
    }
    handles[handle] = handle;
  }
  return handles;
}

async function applyTheme(
  database: DatabaseOrTransaction,
  site: StarterSite,
  context: StarterSiteContext,
): Promise<boolean> {
  // The template's theme is checked like any other change to the website's look.
  const changes = updateWebsiteRequestSchema.parse(site.theme);
  await updateWebsite(database, changes, {
    templates: context.templates,
    builtInSiteUrl: context.builtInSiteUrl,
    assetExists: context.assetExists,
  });
  if (site.siteMotion) await applySiteMotion(database, site.siteMotion);
  return true;
}

/** The template's site-wide motion, part by part over what the site has now. */
async function applySiteMotion(
  database: DatabaseOrTransaction,
  motion: NonNullable<StarterSite["siteMotion"]>,
): Promise<void> {
  const current = await readSiteEffects(database);
  await updateSiteEffects(database, {
    pageTransition: { ...current.pageTransition, ...motion.pageTransition },
    cursor: { ...current.cursor, ...motion.cursor },
    intro: { ...current.intro, ...motion.intro },
    smoothScroll: { ...current.smoothScroll, ...motion.smoothScroll },
  });
}

/**
 * Links every page in an empty main menu; a menu with links is left for the person. After
 * "Replace my pages", links to the pages that went to the recycle bin are taken out first.
 * A menu that follows the page tree shows the new pages by itself.
 */
async function fillEmptyMainMenu(
  database: DatabaseOrTransaction,
  pages: readonly AppliedStarterPage[],
  site: Site,
  replacedIds: readonly string[],
): Promise<"filled" | "hasLinks" | "left"> {
  let menu: NavigationResponse;
  try {
    menu = await findNavigation(database, mainMenu.handle, site);
  } catch (error) {
    if (error instanceof NavigationNotFoundError) {
      return "left";
    }
    throw error;
  }
  if (menu.source === "pageTree") {
    return "filled";
  }
  let items = menu.items;
  if (replacedIds.length > 0) {
    items = replacedIds.reduce((kept, entryId) => removePageItems(kept, entryId), items);
    await updateNavigation(database, mainMenu.handle, { items }, site);
  }
  if (items.length > 0) {
    return "hasLinks";
  }
  await addPagesToMainMenu(
    database,
    pages.map((page) => page.entryId),
    site,
  );
  return "filled";
}

/**
 * Adds a link to each page at the end of the main menu, leaving its links as they are and
 * skipping pages it already links to. Answers how many links were added.
 */
export async function addPagesToMainMenu(
  database: DatabaseOrTransaction,
  entryIds: readonly string[],
  site?: Site,
): Promise<number> {
  const menu = await findNavigation(database, mainMenu.handle, site);
  const linked = new Set(linkedEntryIds(menu.items));
  const adding = [...new Set(entryIds)].filter((entryId) => !linked.has(entryId));
  if (adding.length === 0) return 0;
  await updateNavigation(
    database,
    mainMenu.handle,
    {
      items: [
        ...menu.items,
        ...adding.map((entryId) => ({
          id: randomUUID(),
          label: "",
          entryId,
          url: null,
          newTab: false,
          children: [],
        })),
      ],
    },
    site,
  );
  return adding.length;
}
