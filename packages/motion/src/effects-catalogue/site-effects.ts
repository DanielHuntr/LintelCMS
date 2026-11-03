import { z } from "zod";
import type { SiteEffectSettings } from "../effects/effect-types.js";

/**
 * Motion across the whole site: the page transition and the first-visit intro (set in
 * Settings → Your website) and the cursor (set in the builder's Animate tab). Everything
 * starts off ("none"), so a new site ships no effect code at all. The CSS and markup here are written into every page by
 * the server; the runtime only adds what CSS can't do. The transition looks are in
 * page-transition-looks.ts and the intro in site-intro.ts.
 */

const hexColour = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, { error: "Colours should be written like #7539fd" });

export const siteEffectSettingsSchema = z.object({
  pageTransition: z
    .object({
      style: z.enum(["none", "fade", "slide", "wipe", "zoom"]).default("none"),
      duration: z.number().min(100).max(1500).default(500),
    })
    .default({ style: "none", duration: 500 }),
  cursor: z
    .object({
      style: z.enum(["none", "dot", "ring", "ring-and-dot", "blend"]).default("none"),
      trail: z.enum(["none", "dots", "line", "comet"]).default("none"),
      colour: hexColour.default("#111111"),
      size: z.number().min(8).max(96).default(32),
    })
    .default({ style: "none", trail: "none", colour: "#111111", size: 32 }),
  intro: z
    .object({
      style: z.enum(["none", "counter", "name", "logo", "curtain"]).default("none"),
      text: z.string().trim().max(60).default(""),
      background: hexColour.default("#111111"),
      colour: hexColour.default("#ffffff"),
    })
    .default({ style: "none", text: "", background: "#111111", colour: "#ffffff" }),
}) satisfies z.ZodType<SiteEffectSettings>;

export const defaultSiteEffectSettings: SiteEffectSettings = siteEffectSettingsSchema.parse({});

/** Whether any site-wide effect is switched on, so pages need the runtime. */
export function hasSiteEffects(settings: SiteEffectSettings): boolean {
  return (
    settings.pageTransition.style !== "none" ||
    settings.cursor.style !== "none" ||
    settings.intro.style !== "none"
  );
}
