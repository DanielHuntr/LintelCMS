import { z } from "zod";
import type { SiteEffectSettings } from "../effects/effect-types.js";
import {
  cursorIsOn,
  cursorWordColourPattern,
  defaultCursorPicture,
  defaultCursorWordLook,
  safePictureAddress,
} from "../effects/kit/cursor-look.js";

/**
 * Motion across the whole site: the page transition and the first-visit intro (set in
 * Settings → Your website), and the cursor and smooth scrolling (set in the builder's
 * Animate tab). Everything starts off ("none"), so a new site ships no effect code at all.
 * The CSS and markup here are written into every page by the server; the runtime only adds
 * what CSS can't do. The transition looks are in page-transition-looks.ts and the intro in
 * site-intro.ts.
 */

const hexColour = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, { error: "Colours should be written like #7539fd" });

/** The theme's text or brand colour (so it follows light and dark), or one picked by hand. */
const cursorColour = z.union([z.enum(["text", "brand"]), hexColour]);

/** The word's colours: "auto", a hex colour, or a site or theme colour variable. */
const wordColour = z.union([
  z.literal("auto"),
  z.string().regex(cursorWordColourPattern, { error: "Choose one of the site's colours" }),
]);

/**
 * The word's look and the cursor's own picture. Settings saved before either existed
 * read as the standard look and no picture, which draw exactly what they drew before.
 */
const cursorWordLook = z
  .object({
    background: wordColour.default("auto"),
    colour: wordColour.default("auto"),
    size: z.enum(["small", "medium", "large"]).default("medium"),
    shape: z.enum(["pill", "square", "circle"]).default("pill"),
  })
  .default(defaultCursorWordLook);

const cursorPicture = z
  .object({
    assetId: z.string().max(200).default(""),
    src: z
      .string()
      .trim()
      .max(2000)
      .refine((address) => address === "" || safePictureAddress(address) !== "", {
        error: "Use a picture from the media library or a web address",
      })
      .default(""),
    size: z.number().min(16).max(96).default(32),
    point: z.enum(["centre", "top-left"]).default("centre"),
    bytes: z.number().int().min(0).default(0),
  })
  .default(defaultCursorPicture);

export const siteEffectSettingsSchema = z.object({
  pageTransition: z
    .object({
      style: z.enum(["none", "fade", "slide", "wipe", "zoom"]).default("none"),
      duration: z.number().min(100).max(1500).default(500),
    })
    .default({ style: "none", duration: 500 }),
  cursor: z
    .object({
      style: z.enum(["none", "dot", "ring", "ring-and-dot", "blend", "picture"]).default("none"),
      trail: z.enum(["none", "dots", "line", "comet"]).default("none"),
      colour: cursorColour.default("text"),
      size: z.number().min(8).max(96).default(32),
      word: cursorWordLook,
      picture: cursorPicture,
    })
    .default({
      style: "none",
      trail: "none",
      colour: "text",
      size: 32,
      word: defaultCursorWordLook,
      picture: defaultCursorPicture,
    }),
  intro: z
    .object({
      style: z.enum(["none", "counter", "name", "logo", "curtain"]).default("none"),
      text: z.string().trim().max(60).default(""),
      background: hexColour.default("#111111"),
      colour: hexColour.default("#ffffff"),
    })
    .default({ style: "none", text: "", background: "#111111", colour: "#ffffff" }),
  smoothScroll: z
    .object({ strength: z.enum(["off", "gentle", "strong"]).default("off") })
    .default({ strength: "off" }),
}) satisfies z.ZodType<SiteEffectSettings>;

export const defaultSiteEffectSettings = siteEffectSettingsSchema.parse({});

/** Whether any site-wide effect is switched on, so pages need the runtime. */
export function hasSiteEffects(settings: SiteEffectSettings): boolean {
  return (
    settings.pageTransition.style !== "none" ||
    cursorIsOn(settings.cursor) ||
    settings.intro.style !== "none" ||
    settings.smoothScroll.strength !== "off"
  );
}
