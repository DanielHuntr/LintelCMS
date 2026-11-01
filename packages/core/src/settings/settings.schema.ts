import { z } from "zod";

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
  /** The site's name, from the "What's your site called?" setup step. Null until then. */
  siteName: siteNameSchema.nullable(),
};

export type SettingKey = keyof typeof settingSchemas;
export type SettingValue<Key extends SettingKey> = z.infer<(typeof settingSchemas)[Key]>;

export const settingDefaults: { [Key in SettingKey]: SettingValue<Key> } = {
  enabledPlugins: [],
  siteType: null,
  siteSetupCompleted: false,
  siteName: null,
};
