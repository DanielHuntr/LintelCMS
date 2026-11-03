import { emptySiteDesign, type SiteDesign, siteDesignSchema } from "@lintel/builder-model";
import type { DatabaseOrTransaction } from "../database/client.js";
import { SiteDesignChangedError } from "./site-design.errors.js";
import {
  findStoredSiteDesign,
  findStoredSiteDesignUpdatedAt,
  saveStoredSiteDesign,
} from "./site-design.repository.js";

/**
 * The site's design system: its design variables (named colours, sizes and fonts) and its
 * shared styles, made and changed in the page builder. Every page is drawn with them, so a
 * change shows on every page at once. Nothing is set until someone makes the first one.
 */

/** The saved design system, or an empty one when nothing (or something unreadable) is saved. */
export async function readSiteDesign(database: DatabaseOrTransaction): Promise<SiteDesign> {
  const parsed = siteDesignSchema.safeParse((await findStoredSiteDesign(database)) ?? {});
  return parsed.success ? parsed.data : emptySiteDesign;
}

/**
 * Which save of the design system this is: when it was saved, or null before the first. The
 * builder sends back the one it started from, so a change made from an older copy is refused
 * (`saveSiteDesign`) rather than undoing someone else's.
 */
export async function readSiteDesignRevision(
  database: DatabaseOrTransaction,
): Promise<string | null> {
  return (await findStoredSiteDesignUpdatedAt(database))?.toISOString() ?? null;
}

/**
 * Saves the whole design system, checked, and hands back what was saved. With
 * `expectedRevision` (what `readSiteDesignRevision` said when the copy was read) it refuses
 * when someone has saved it since.
 */
export async function saveSiteDesign(
  database: DatabaseOrTransaction,
  design: SiteDesign,
  expectedRevision?: string | null,
): Promise<SiteDesign> {
  if (
    expectedRevision !== undefined &&
    (await readSiteDesignRevision(database)) !== expectedRevision
  ) {
    throw new SiteDesignChangedError();
  }
  const checked = siteDesignSchema.parse(design);
  await saveStoredSiteDesign(database, checked);
  return checked;
}
