import {
  completeTheme,
  findTemplate,
  fontPairings,
  type SiteTemplate,
  type SiteTheme,
} from "@lintel/site-components";
import type { DatabaseOrTransaction } from "../database/client.js";
import type { AssetExists } from "../fieldtypes/image-assets.js";
import {
  readEffectiveSiteAddress,
  readSiteAddress,
  saveSiteAddress,
} from "../sites/site-address.service.js";
import { readSetting, writeSetting } from "../settings/settings.service.js";
import { listLocales } from "../sites/locales.service.js";
import type { SiteType } from "../settings/settings.schema.js";
import { LogoNotFoundError, UnknownTemplateError } from "./website.errors.js";
import type { UpdateWebsiteRequest, WebsiteResponse, WebsiteSettings } from "./website.schema.js";

/**
 * Settings, Site: the built-in website's template, theme, logo and address. There is no
 * repository: everything is kept in settings (`website`, and `siteAddress` from src/sites).
 */

/** What the site looks like, with every default filled in. */
export interface WebsiteLook {
  template: SiteTemplate;
  theme: SiteTheme;
  logoAssetId: string | null;
  /** Families chosen for headings and body text over the pairing's; null follows the pairing. */
  headingFont: string | null;
  bodyFont: string | null;
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
    headingFont: settings.headingFont,
    bodyFont: settings.bodyFont,
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

/** What "View page" in the editor needs to build a page's full address. */
export async function readViewPageAddress(
  database: DatabaseOrTransaction,
  builtInSiteUrl: string | null,
): Promise<{ siteAddress: string | null; defaultLocale: string }> {
  const [siteAddress, { defaultLocale }] = await Promise.all([
    readEffectiveSiteAddress(database, builtInSiteUrl),
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
  const siteAddress = await readSiteAddress(database);
  return {
    template: look.template.id,
    theme: look.theme,
    logoAssetId: look.logoAssetId,
    headingFont: look.headingFont,
    bodyFont: look.bodyFont,
    siteAddress,
    effectiveSiteAddress: siteAddress || context.builtInSiteUrl,
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
    await saveSiteAddress(database, siteAddress);
  }
  return readWebsite(database, context);
}
