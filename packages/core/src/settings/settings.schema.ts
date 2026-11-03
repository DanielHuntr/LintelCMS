import { customScriptRules } from "@lintel/builder-model";
import { defaultSiteEffectSettings, siteEffectSettingsSchema } from "@lintel/motion/effects";
import { z } from "zod";
import { formsSpamSettingsSchema } from "../forms/forms-settings.schema.js";
import { brandingOverridesSchema } from "../branding/branding.schema.js";
import { backupScheduleSchema, defaultBackupSchedule } from "../backups/backups.schema.js";
import { defaultSeoDefaults, seoDefaultsSchema } from "../seo/seo-defaults.schema.js";
import {
  defaultUpdatePreferences,
  emptyUpdateCheck,
  updateCheckSchema,
  updatePreferencesSchema,
} from "../updates/updates.schema.js";
import { defaultWebsiteSettings, websiteSettingsSchema } from "../website/website.schema.js";

/**
 * Every setting, with the shape its value must have. Reading a key that has never been
 * saved gives its default, so a fresh install needs no rows at all.
 */
export const siteTypes = ["business", "blog", "shop", "portfolio", "blank"] as const;

export const siteTypeSchema = z.enum(siteTypes, {
  error: `The site type should be one of: ${siteTypes.join(", ")}`,
});

export type SiteType = z.infer<typeof siteTypeSchema>;

export const maximumSiteNameLength = 80;

/** The site's name, as people see it in browser tabs and across the site. */
export const siteNameSchema = z
  .string({ error: "Please give your site a name" })
  .trim()
  .min(1, { error: "Please give your site a name" })
  .max(maximumSiteNameLength, {
    error: `Site names can be at most ${maximumSiteNameLength} characters`,
  });

export const settingSchemas = {
  /** The ids of the plugins that are switched on, in registry order. */
  enabledPlugins: z.array(z.string()),
  /** What the site is for, picked in the last setup step. Null until then. */
  siteType: siteTypeSchema.nullable(),
  /** Whether the "What are you building?" step has been done. */
  siteSetupCompleted: z.boolean(),
  /** Signs live preview links (see src/preview). Made the first time a preview is opened. */
  previewSigningSecret: z.string().min(32).nullable(),
  /** When true, /delivery and /graphql need an API token (see src/delivery). */
  deliveryRequiresToken: z.boolean(),
  /** Website origins allowed to call the content APIs from the browser. */
  deliveryAllowedOrigins: z.array(z.string()),
  /** Search engine defaults from the SEO plugin (see src/seo). */
  seoDefaults: seoDefaultsSchema,
  /**
   * The website's public address, such as https://www.example.com, typed in Settings → Your
   * website: the one address the website, "View page", the sitemap and canonical addresses
   * use (see src/sites). Empty means the built-in website's own address, if there is one.
   */
  siteAddress: z.string(),
  /** The site's name, from the "What's your site called?" setup step. Null until then. */
  siteName: siteNameSchema.nullable(),
  /** The built-in website's template, theme, logo and address (see src/website). */
  website: websiteSettingsSchema,
  /** What happens to scripts in the page builder's code blocks when a page is saved (see src/pages). */
  builderCustomScripts: z.enum(customScriptRules),
  /** What each content model unit was when files and database last agreed (src/content-model-sync). */
  contentModelSyncBase: z.record(z.string(), z.string()),
  /** Cloudflare Turnstile keys for forms (see src/forms). */
  formsSpamProtection: formsSpamSettingsSchema,
  /** Signs the "when was this form opened" token (see src/forms/spam-protection.ts). */
  formsSigningSecret: z.string().min(32).nullable(),
  /** Branding changed in Settings, on top of the deployment's (see src/branding). */
  brandingOverrides: brandingOverridesSchema,
  /** The admin's language for anyone who hasn't picked their own (see src/interface-languages). */
  defaultInterfaceLanguage: z.string().nullable(),
  /** How often Lintel backs itself up, and how many of those it keeps (see src/backups). */
  backupSchedule: backupScheduleSchema,
  /** What the last look for new versions found (see src/updates). */
  updateCheck: updateCheckSchema,
  /** Stable releases only, or betas too (Settings → Updates). */
  updatePreferences: updatePreferencesSchema,
  /** Page transitions, cursor and intro across the website (see src/site-effects). */
  siteEffects: siteEffectSettingsSchema,
};

export type SettingKey = keyof typeof settingSchemas;
export type SettingValue<Key extends SettingKey> = z.infer<(typeof settingSchemas)[Key]>;

export const settingDefaults: { [Key in SettingKey]: SettingValue<Key> } = {
  enabledPlugins: [],
  siteType: null,
  siteSetupCompleted: false,
  previewSigningSecret: null,
  deliveryRequiresToken: false,
  deliveryAllowedOrigins: [],
  seoDefaults: defaultSeoDefaults,
  siteAddress: "",
  siteName: null,
  website: defaultWebsiteSettings,
  builderCustomScripts: "removeScripts",
  contentModelSyncBase: {},
  formsSpamProtection: { turnstileSiteKey: null, turnstileSecretKey: null },
  formsSigningSecret: null,
  brandingOverrides: {},
  defaultInterfaceLanguage: null,
  backupSchedule: defaultBackupSchedule,
  updateCheck: emptyUpdateCheck,
  updatePreferences: defaultUpdatePreferences,
  siteEffects: defaultSiteEffectSettings,
};
