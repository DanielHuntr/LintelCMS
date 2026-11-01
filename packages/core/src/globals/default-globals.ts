import type { DatabaseOrTransaction } from "../database/client.js";
import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import { ensureGlobalSet, type GlobalSetDefaults } from "./globals.service.js";

/**
 * The global set every site starts with, made during setup. Safe to run again: an
 * existing "Site settings" is left exactly as it is.
 */

function field(
  handle: string,
  label: string,
  type: string,
  extra: Partial<Pick<FieldDefinition, "helpText" | "options">> = {},
): FieldDefinition {
  return { handle, label, type, required: false, helpText: "", options: {}, ...extra };
}

export const siteSettingsGlobalSet: GlobalSetDefaults = {
  handle: "site_settings",
  name: "Site settings",
  fields: [
    field("site_name", "Site name", "text", {
      helpText: "Shown in the header and in browser tabs",
      options: { maxLength: 100 },
    }),
    field("footer_text", "Footer text", "textarea", {
      helpText: "A line or two at the bottom of every page",
    }),
    field("contact_email", "Contact email", "email"),
    field("social_links", "Social links", "list", {
      helpText: "One web address in each box, such as your Instagram or LinkedIn page",
      options: { maxItems: 10 },
    }),
  ],
};

export function ensureSiteSettings(database: DatabaseOrTransaction): Promise<void> {
  return ensureGlobalSet(database, siteSettingsGlobalSet);
}
