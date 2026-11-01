import { customScriptRules } from "@lintel/builder-model";
import { z } from "zod";

/** The page builder's site settings, as `GET /pages/settings` returns and `PATCH` takes them. */
export const pageSettingsSchema = z.object({
  customScripts: z.enum(customScriptRules, {
    error: `customScripts should be one of: ${customScriptRules.join(", ")}`,
  }),
});

export type PageSettings = z.infer<typeof pageSettingsSchema>;
