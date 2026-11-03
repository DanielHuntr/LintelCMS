import {
  defaultSiteEffectSettings,
  hasSiteEffects,
  introCss,
  introMarkup,
  introSeenScript,
  pageTransitionCss,
  siteEffectSettingsSchema,
  type SiteEffectSettings,
} from "@lintel/motion/effects";
import type { SiteEffectsHead } from "@lintel/site-components";
import type { DatabaseOrTransaction } from "../database/client.js";
import { findStoredSiteEffects, saveStoredSiteEffects } from "./site-effects.repository.js";

/**
 * Motion across the whole website: the page transition, the cursor, the intro and smooth
 * scrolling, chosen
 * in the page builder's site settings. Everything is off until someone switches it on, so
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

/** What every page's head and body get for the site-wide effects, or nothing when all are off. */
export function siteEffectsHead(
  settings: SiteEffectSettings,
  labels: { skip: string; loading: string },
): SiteEffectsHead | undefined {
  if (!hasSiteEffects(settings)) return undefined;
  const modules = [
    settings.cursor.style !== "none" ? "cursor" : "",
    settings.pageTransition.style !== "none" ? "transitions" : "",
    settings.intro.style !== "none" ? "intro" : "",
    settings.smoothScroll.strength !== "off" ? "smooth-scroll" : "",
  ].filter(Boolean);
  const introOn = settings.intro.style !== "none";
  return {
    css: [pageTransitionCss(settings), introCss(settings)].filter(Boolean).join("\n"),
    bodyStartHtml: introMarkup(settings, labels),
    headScript: introOn ? introSeenScript : "",
    settings: { ...settings },
    modules,
  };
}
