import { customScriptRules } from "@lintel/builder-model";
import { z } from "zod";
import { defaultSeoDefaults, seoDefaultsSchema } from "../seo/seo-defaults.schema.js";
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
  /** What happens to scripts in the page builder's code blocks when a page is saved (see src/pages). */
  builderCustomScripts: z.enum(customScriptRules),
  /** The built-in website's template, theme, logo and address (see src/website). */
  website: websiteSettingsSchema,
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
  builderCustomScripts: "removeScripts",
  website: defaultWebsiteSettings,
};
