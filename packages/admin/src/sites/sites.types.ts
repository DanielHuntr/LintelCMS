/** One website this Lintel serves. Matches the API's `Site` (packages/core/src/sites). */
export interface Site {
  id: string;
  handle: string;
  name: string;
  /** The first site, which can't be deleted. */
  isDefault: boolean;
  /** Domains it answers on, such as "acme.fr". */
  hostnames: string[];
  /** "/fr" when sites share a domain; "" otherwise. */
  pathPrefix: string;
  /** Its public address, such as "https://acme.fr". Empty until set. */
  siteUrl: string;
  defaultLocale: string;
  locales: { code: string; name: string }[];
  branding: { logoAssetId: string | null; accentColor: string | null };
  entryCount: number;
}

export interface NewSite {
  handle: string;
  name: string;
  hostnames: string[];
  pathPrefix: string;
  siteUrl: string;
  defaultLocale: string;
  extraLocales: string[];
  branding?: { accentColor: string | null };
}

export type SiteChanges = Partial<Omit<NewSite, "handle" | "extraLocales">>;

/** A role and the sites its people may work on; null for every site. */
export interface RoleSiteAccess {
  handle: string;
  name: string;
  siteHandles: string[] | null;
}

/** "per-site": each site has its own entries; "shared": every site shows the same ones. */
export type CollectionSiteScope = "per-site" | "shared";
