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
import { ensurePagesCollection, pagesCollection } from "../collections/default-collections.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { createEntry, type EntryChangeContext } from "../entries/entries.service.js";
import type { EntryResponse } from "../entries/entries.schema.js";
import { publishEntry } from "../entries/entry-publishing.service.js";
import { InvalidFieldsError } from "../http/http-errors.js";
import { mainMenu } from "../navigation/default-navigation.js";
import { linkedEntryIds } from "../navigation/navigation-items.js";
import type { NavigationItem } from "../navigation/navigation.schema.js";
import { findNavigation, updateNavigation } from "../navigation/navigation.service.js";
import type { Site } from "../sites/sites.table.js";
import { NavigationNotFoundError } from "../navigation/navigation.errors.js";
import { pageComponentCatalogue } from "../pages/page-components.js";
import { createForm, listForms } from "../forms/forms.service.js";
import { type FormTemplateId, formTemplateIds } from "../forms/form-templates.js";
import { findEnabledPluginIds } from "../plugins/plugins.service.js";
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
 *   - an empty main menu gets a link to each page; a menu with links is left alone, and the
 *     admin offers to add them (`addPagesToMainMenu`).
 *
 * Nothing that exists is changed: a page whose address is taken gets the next free one
 * ("menu-2"). Everything happens on the site the editor is working on.
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
  const enabledPlugins = await findEnabledPluginIds(database);
  const forms = enabledPlugins.includes("forms")
    ? await ensureTemplateForms(database, site, context)
    : {};
  const mayPublish = request.publish && hasPermission(context.permissions, "entries:publish");
  const pages: AppliedStarterPage[] = [];
  for (const page of site.pages) {
    const created = await createStarterPage(database, page, context, context.site, {
      enabledPlugins,
      forms,
    });
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
  const menu = hasPermission(context.permissions, "navigation:update")
    ? await fillEmptyMainMenu(database, pages, context.site)
    : "left";
  return {
    starterSiteId: site.id,
    pages,
    themeApplied,
    menuFilled: menu === "filled",
    menuHasLinks: menu === "hasLinks",
  };
}

/** The page at the template's address, or the next free one ("about-2") if that's taken. */
async function createStarterPage(
  database: DatabaseOrTransaction,
  page: StarterPage,
  context: EntryChangeContext,
  site: Site | undefined,
  options: StarterPageOptions,
): Promise<EntryResponse> {
  const data = {
    title: page.title,
    summary: page.summary,
    design: buildStarterPage(page, pageComponentCatalogue, createRandomNodeId, options),
  };
  for (let attempt = 1; ; attempt += 1) {
    const slug = attempt === 1 ? page.slug : `${page.slug}-${attempt}`;
    try {
      return await createEntry(database, pagesCollection.handle, { data, slug }, context, site);
    } catch (error) {
      const isSlugTaken = error instanceof InvalidFieldsError && attempt < 20;
      if (!isSlugTaken) {
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
  return true;
}

/** Links every page in an empty main menu; a menu with links is left for the person. */
async function fillEmptyMainMenu(
  database: DatabaseOrTransaction,
  pages: readonly AppliedStarterPage[],
  site: Site | undefined,
): Promise<"filled" | "hasLinks" | "left"> {
  let items: NavigationItem[];
  try {
    items = (await findNavigation(database, mainMenu.handle, site)).items;
  } catch (error) {
    if (error instanceof NavigationNotFoundError) {
      return "left";
    }
    throw error;
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
