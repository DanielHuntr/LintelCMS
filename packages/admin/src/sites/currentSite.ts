/**
 * The site the admin is working on, kept between visits. The API client sends it with
 * every request as the `Lintel-Site` header, so every list and editor shows that site's
 * content without each screen having to pass it along.
 */

const STORAGE_KEY = "lintel.currentSite";
export const SITE_HEADER = "lintel-site";

let current: string | undefined = readStoredSite();

function readStoredSite(): string | undefined {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) ?? undefined;
  } catch {
    // Storage can be switched off; the admin then starts on the main site each visit.
    return undefined;
  }
}

/** The handle of the site requests are for; undefined means the main site. */
export function currentSiteHandle(): string | undefined {
  return current;
}

export function rememberCurrentSite(handle: string | undefined): void {
  current = handle;
  try {
    if (handle === undefined) {
      globalThis.localStorage?.removeItem(STORAGE_KEY);
    } else {
      globalThis.localStorage?.setItem(STORAGE_KEY, handle);
    }
  } catch {
    // Not being able to remember it only means starting on the main site next time.
  }
}

/** The header to send for the current site, or none for the main site. */
export function siteHeaders(): Record<string, string> {
  return current === undefined ? {} : { [SITE_HEADER]: current };
}

/**
 * The site to work on from those the person may use: the one asked for if it is still
 * there, else the main site, else the first they're allowed on.
 */
export function pickCurrentSite<Site extends { handle: string; isDefault: boolean }>(
  sites: readonly Site[],
  wanted: string | undefined,
): Site | undefined {
  return (
    sites.find((site) => site.handle === wanted) ?? sites.find((site) => site.isDefault) ?? sites[0]
  );
}

/** Picks the site to work on, starting from the one used last, and remembers it. */
export function chooseCurrentSite<Site extends { handle: string; isDefault: boolean }>(
  sites: readonly Site[],
): Site | undefined {
  const chosen = pickCurrentSite(sites, current);
  rememberCurrentSite(chosen?.handle);
  return chosen;
}
