import { emptySiteDesign, type SiteDesign, siteDesignSchema } from "@lintel/builder-model";
import type { DatabaseOrTransaction } from "../database/client.js";
import type { Site } from "../sites/sites.table.js";
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
 * Each site of a multisite install has its own (see docs/decisions/0045).
 */

/** The saved design system, or an empty one when nothing (or something unreadable) is saved. */
export async function readSiteDesign(
  database: DatabaseOrTransaction,
  site: Pick<Site, "id">,
): Promise<SiteDesign> {
  const parsed = siteDesignSchema.safeParse((await findStoredSiteDesign(database, site.id)) ?? {});
  return parsed.success ? parsed.data : emptySiteDesign;
}

/**
 * Which save of the design system this is: when it was saved, or null before the first. The
 * builder sends back the one it started from, so a change made from an older copy is refused
 * (`saveSiteDesign`) rather than undoing someone else's.
 */
export async function readSiteDesignRevision(
  database: DatabaseOrTransaction,
  site: Pick<Site, "id">,
): Promise<string | null> {
  return (await findStoredSiteDesignUpdatedAt(database, site.id))?.toISOString() ?? null;
}

/**
 * Saves the whole design system, checked, and hands back what was saved. With
 * `expectedRevision` (what `readSiteDesignRevision` said when the copy was read) it refuses
 * when someone has saved it since.
 */
export async function saveSiteDesign(
  database: DatabaseOrTransaction,
  site: Pick<Site, "id">,
  design: SiteDesign,
  expectedRevision?: string | null,
): Promise<SiteDesign> {
  if (
    expectedRevision !== undefined &&
    (await readSiteDesignRevision(database, site)) !== expectedRevision
  ) {
    throw new SiteDesignChangedError();
  }
  const checked = siteDesignSchema.parse(design);
  await saveStoredSiteDesign(database, site.id, checked);
  return checked;
}
