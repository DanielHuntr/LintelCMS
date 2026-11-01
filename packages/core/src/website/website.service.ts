import {
  completeTheme,
  findTemplate,
  fontPairings,
  type SiteTemplate,
  type SiteTheme,
} from "@lintel/site-components";
import type { DatabaseOrTransaction } from "../database/client.js";
import type { AssetExists } from "../fieldtypes/image-assets.js";
import { readSeoDefaults, updateSeoDefaults } from "../seo/seo-defaults.service.js";
import { readSetting, writeSetting } from "../settings/settings.service.js";
import { listLocales } from "../sites/locales.service.js";
import type { SiteType } from "../settings/settings.schema.js";
import { LogoNotFoundError, UnknownTemplateError } from "./website.errors.js";
import type { UpdateWebsiteRequest, WebsiteResponse, WebsiteSettings } from "./website.schema.js";

/**
 * Settings, Site: the built-in website's template, theme, logo and address. There is no
 * repository: everything is kept in settings (`website`, and the SEO defaults' `siteUrl`).
 */

/** What the site looks like, with every default filled in. */
export interface WebsiteLook {
  template: SiteTemplate;
  theme: SiteTheme;
  logoAssetId: string | null;
}

/** A blog gets the Journal template; every other kind of site starts with Clean. */
export function defaultTemplateFor(siteType: SiteType | null): string {
  return siteType === "blog" ? "journal" : "clean";
}

/**
 * The template saved in Settings, Site (or the one the site type suggests), and its theme:
 * the template's default theme with each choice made in Settings laid over it.
 */
export function resolveLook(
  settings: WebsiteSettings,
  siteType: SiteType | null,
  templates: readonly SiteTemplate[],
): WebsiteLook {
  const template = findTemplate(settings.template ?? defaultTemplateFor(siteType), templates);
  const chosen = Object.fromEntries(
    Object.entries({
      brandColour: settings.brandColour,
      accentColour: settings.accentColour,
      fontPairing: settings.fontPairing,
      cornerStyle: settings.cornerStyle,
      spacing: settings.spacing,
      colourScheme: settings.colourScheme,
    }).filter(([, value]) => value !== null),
  );
  return {
    template,
    theme: completeTheme({ ...template.defaultTheme, ...chosen }, template.defaultTheme),
    logoAssetId: settings.logoAssetId,
  };
}

export async function readWebsiteLook(
  database: DatabaseOrTransaction,
  templates: readonly SiteTemplate[],
): Promise<WebsiteLook> {
  const [settings, siteType] = await Promise.all([
    readSetting(database, "website"),
    readSetting(database, "siteType"),
  ]);
  return resolveLook(settings, siteType, templates);
}

/** The site's address: what was saved, else the built-in site's own. Null when neither. */
export async function findSiteAddress(
  database: DatabaseOrTransaction,
  builtInSiteUrl: string | null,
): Promise<string | null> {
  const { siteUrl } = await readSeoDefaults(database);
  return siteUrl || builtInSiteUrl;
}

/** What "View page" in the editor needs to build a page's full address. */
export async function readSiteAddress(
  database: DatabaseOrTransaction,
  builtInSiteUrl: string | null,
): Promise<{ siteAddress: string | null; defaultLocale: string }> {
  const [siteAddress, { defaultLocale }] = await Promise.all([
    findSiteAddress(database, builtInSiteUrl),
    listLocales(database),
  ]);
  return { siteAddress, defaultLocale };
}

export interface WebsiteContext {
  templates: readonly SiteTemplate[];
  builtInSiteUrl: string | null;
}

export async function readWebsite(
  database: DatabaseOrTransaction,
  context: WebsiteContext,
): Promise<WebsiteResponse> {
  const look = await readWebsiteLook(database, context.templates);
  const { siteUrl } = await readSeoDefaults(database);
  return {
    template: look.template.id,
    theme: look.theme,
    logoAssetId: look.logoAssetId,
    siteAddress: siteUrl,
    effectiveSiteAddress: siteUrl || context.builtInSiteUrl,
    builtInSiteUrl: context.builtInSiteUrl,
    templates: context.templates.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      defaultTheme: template.defaultTheme,
    })),
    fontPairings: fontPairings.map(({ id, name, description }) => ({ id, name, description })),
  };
}

/**
 * Changes only what is sent. Choosing another template starts from its own theme again,
 * unless theme choices are sent with it, so each template looks as it was designed.
 */
export async function updateWebsite(
  database: DatabaseOrTransaction,
  request: UpdateWebsiteRequest,
  context: WebsiteContext & { assetExists: AssetExists },
): Promise<WebsiteResponse> {
  const { siteAddress, ...changes } = request;
  if (
    changes.template !== undefined &&
    !context.templates.some(({ id }) => id === changes.template)
  ) {
    throw new UnknownTemplateError();
  }
  if (changes.logoAssetId && !(await context.assetExists(changes.logoAssetId))) {
    throw new LogoNotFoundError();
  }
  const current = await readSetting(database, "website");
  const switchingTemplate = changes.template !== undefined && changes.template !== current.template;
  const base: WebsiteSettings = switchingTemplate
    ? {
        ...current,
        brandColour: null,
        accentColour: null,
        fontPairing: null,
        cornerStyle: null,
        spacing: null,
      }
    : current;
  await writeSetting(database, "website", { ...base, ...changes });
  if (siteAddress !== undefined) {
    await updateSeoDefaults(database, { siteUrl: siteAddress });
  }
  return readWebsite(database, context);
}
