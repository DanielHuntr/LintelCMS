import { z } from "zod";

/**
 * The cookie notice's settings, chosen in Settings → Your website → Cookie notice, one set
 * for every site of the install like the rest of the website's look.
 *
 * - `automatic` (the default) shows the notice only while the site uses something that may
 *   set cookies or contact another company: videos, maps, embeds, Adobe Fonts, a plugin that
 *   says so. Sites with none of these show nothing.
 * - `always` shows it even when nothing like that is found, for sites with their own scripts.
 * - `off` never shows it; embeds still wait for a press of their own button.
 */
export const cookieNoticeModes = ["automatic", "always", "off"] as const;
export const cookieNoticePositions = ["bar", "corner"] as const;

export const cookieNoticeSettingsSchema = z.object({
  mode: z
    .enum(cookieNoticeModes, { error: "Choose Automatic, Always or Off" })
    .default("automatic"),
  position: z
    .enum(cookieNoticePositions, { error: "Choose a bar or a corner card" })
    .default("bar"),
  /** Left empty, the notice's own heading is used. */
  heading: z
    .string()
    .trim()
    .max(80, { error: "The heading can be at most 80 characters" })
    .default(""),
  /** Left empty, the notice names the services itself. `{services}` is replaced by their names. */
  message: z
    .string()
    .trim()
    .max(400, { error: "The message can be at most 400 characters" })
    .default(""),
  /** The page the notice links to for more about privacy, or null. */
  privacyPageId: z.uuid({ error: "Choose a page for privacy" }).nullable().default(null),
});

export type CookieNoticeSettings = z.output<typeof cookieNoticeSettingsSchema>;
export type CookieNoticeMode = CookieNoticeSettings["mode"];

export const defaultCookieNoticeSettings: CookieNoticeSettings = {
  mode: "automatic",
  position: "bar",
  heading: "",
  message: "",
  privacyPageId: null,
};

export const updateCookieNoticeRequestSchema = cookieNoticeSettingsSchema.partial();

/** One service the site uses, as the admin lists them. */
export interface ConsentServiceResponse {
  id: string;
  name: string;
}

/** GET /website/cookie-notice: the settings, and what the site uses that the notice names. */
export interface CookieNoticeResponse {
  settings: CookieNoticeSettings;
  services: ConsentServiceResponse[];
  /** Whether visitors see the notice with these settings. */
  shown: boolean;
}
