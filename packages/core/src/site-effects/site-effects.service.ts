import {
  carriedElementsScript,
  defaultSiteEffectSettings,
  hasSiteEffects,
  introCss,
  introMarkup,
  introSeenScript,
  pageTransitionCss,
  siteEffectSettingsSchema,
  type SiteEffectSettings,
} from "@lintel/motion/effects";
import type { SiteChrome, SiteEffectsHead } from "@lintel/site-components";
import type { DatabaseOrTransaction } from "../database/client.js";
import { findStoredSiteEffects, saveStoredSiteEffects } from "./site-effects.repository.js";

/**
 * Motion across the whole website: the page transition and the first-visit intro (chosen
 * in Settings → Your website), and the cursor and smooth scrolling (in the page builder's
 * Animate tab). Everything is off until someone switches it on, so
 * a site that never touches this ships no effect code at all.
 */

/** The saved settings, or the defaults when nothing (or something unreadable) is saved. */
export async function readSiteEffects(
  database: DatabaseOrTransaction,
): Promise<SiteEffectSettings> {
  const parsed = siteEffectSettingsSchema.safeParse((await findStoredSiteEffects(database)) ?? {});
  return parsed.success ? parsed.data : defaultSiteEffectSettings;
}

/** Saves a change to any of them; the rest stay as they were. */
export async function updateSiteEffects(
  database: DatabaseOrTransaction,
  changes: Partial<SiteEffectSettings>,
): Promise<SiteEffectSettings> {
  const current = await readSiteEffects(database);
  const next = siteEffectSettingsSchema.parse({ ...current, ...changes });
  await saveStoredSiteEffects(database, next);
  return next;
}

/** The page a site-wide effect is drawn on: where it is and the site's name and logo. */
export interface PageForEffects {
  path: string;
  chrome: Pick<SiteChrome, "homeUrl" | "siteName" | "logo">;
}

const withoutTrailingSlash = (path: string) => (path.length > 1 ? path.replace(/\/+$/, "") : path);

/** The home page, in whichever language it is shown. */
export function isHomePage(page: PageForEffects): boolean {
  return withoutTrailingSlash(page.path) === withoutTrailingSlash(page.chrome.homeUrl);
}

/**
 * What a page's head and body get for the site-wide effects, or nothing when all are off.
 * The intro plays only before the home page: someone arriving at an article from a search
 * goes straight to it.
 */
export function siteEffectsHead(
  saved: SiteEffectSettings,
  page: PageForEffects,
  labels: { skip: string } = { skip: "Skip intro" },
): SiteEffectsHead | undefined {
  const settings: SiteEffectSettings = isHomePage(page)
    ? saved
    : { ...saved, intro: { ...saved.intro, style: "none" } };
  if (!hasSiteEffects(settings)) return undefined;
  const transitionOn = settings.pageTransition.style !== "none";
  const introOn = settings.intro.style !== "none";
  const modules = [
    settings.cursor.style !== "none" ? "cursor" : "",
    transitionOn ? "transitions" : "",
    introOn ? "intro" : "",
    settings.smoothScroll.strength !== "off" ? "smooth-scroll" : "",
  ].filter(Boolean);
  const logo = page.chrome.logo;
  return {
    css: [pageTransitionCss(settings), introCss(settings)].filter(Boolean).join("\n"),
    bodyStartHtml: introMarkup(settings, labels, {
      siteName: page.chrome.siteName,
      logo: logo ? { url: logo.url, alt: logo.alt } : null,
    }),
    headScript: [introOn ? introSeenScript : "", transitionOn ? carriedElementsScript : ""].join(
      "",
    ),
    settings: { ...settings },
    modules,
  };
}
