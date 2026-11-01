import { randomUUID } from "node:crypto";
import {
  buildStarterPage,
  createRandomNodeId,
  findStarterSite,
  type StarterPage,
  type StarterSite,
} from "@lintel/builder-model";
import type { SiteTemplate } from "@lintel/site-components";
import { ensurePagesCollection, pagesCollection } from "../collections/default-collections.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { createEntry, type EntryChangeContext } from "../entries/entries.service.js";
import type { EntryResponse } from "../entries/entries.schema.js";
import { publishEntry } from "../entries/entry-publishing.service.js";
import { InvalidFieldsError } from "../http/http-errors.js";
import { mainMenu } from "../navigation/default-navigation.js";
import { findNavigation, updateNavigation } from "../navigation/navigation.service.js";
import { NavigationNotFoundError } from "../navigation/navigation.errors.js";
import { pageComponentCatalogue } from "../pages/page-components.js";
import { hasPermission } from "../roles/permissions.js";
import { updateWebsiteRequestSchema } from "../website/website.schema.js";
import { updateWebsite } from "../website/website.service.js";
import { StarterSiteNotFoundError } from "./starter-sites.errors.js";
import type {
  AppliedStarterPage,
  AppliedStarterSiteResponse,
  ApplyStarterSiteRequest,
} from "./starter-sites.schema.js";

/**
 * "Start from a template": makes one page in Pages for each of the template's pages, with
 * its design, title and summary, through the entries service (so every page is checked and
 * gets a revision like any other save). Then, as far as the person is allowed:
 *
 *   - the website takes the template's colours, fonts and corners (settings:update);
 *   - the pages are published (entries:publish), otherwise they wait as drafts;
 *   - an empty main menu gets a link to each page.
 *
 * Nothing that exists is changed: a page whose address is taken gets the next free one
 * ("menu-2"), and a menu that already has links is left alone.
 */

export interface StarterSiteContext extends EntryChangeContext {
  permissions: readonly string[];
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
  const mayPublish = request.publish && hasPermission(context.permissions, "entries:publish");
  const pages: AppliedStarterPage[] = [];
  for (const page of site.pages) {
    const created = await createStarterPage(database, page, context);
    const published = mayPublish ? await publishEntry(database, created.id, context) : created;
    pages.push({
      entryId: created.id,
      title: page.title,
      slug: created.slug,
      wantedSlug: page.slug,
      published: published.status === "published",
    });
  }
  const themeApplied =
    request.useTheme && hasPermission(context.permissions, "settings:update")
      ? await applyTheme(database, site, context)
      : false;
  const menuFilled = hasPermission(context.permissions, "navigation:update")
    ? await fillEmptyMainMenu(database, pages)
    : false;
  return { starterSiteId: site.id, pages, themeApplied, menuFilled };
}

/** The page at the template's address, or the next free one ("about-2") if that's taken. */
async function createStarterPage(
  database: DatabaseOrTransaction,
  page: StarterPage,
  context: EntryChangeContext,
): Promise<EntryResponse> {
  const data = {
    title: page.title,
    summary: page.summary,
    design: buildStarterPage(page, pageComponentCatalogue, createRandomNodeId),
  };
  for (let attempt = 1; ; attempt += 1) {
    const slug = attempt === 1 ? page.slug : `${page.slug}-${attempt}`;
    try {
      return await createEntry(database, pagesCollection.handle, { data, slug }, context);
    } catch (error) {
      const isSlugTaken = error instanceof InvalidFieldsError && attempt < 20;
      if (!isSlugTaken) {
        throw error;
      }
    }
  }
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
  return true;
}

async function fillEmptyMainMenu(
  database: DatabaseOrTransaction,
  pages: readonly AppliedStarterPage[],
): Promise<boolean> {
  try {
    const menu = await findNavigation(database, mainMenu.handle);
    if (menu.items.length > 0) {
      return false;
    }
  } catch (error) {
    if (error instanceof NavigationNotFoundError) {
      return false;
    }
    throw error;
  }
  await updateNavigation(database, mainMenu.handle, {
    items: pages.map((page) => ({
      id: randomUUID(),
      label: "",
      entryId: page.entryId,
      url: null,
      newTab: false,
      children: [],
    })),
  });
  return true;
}
