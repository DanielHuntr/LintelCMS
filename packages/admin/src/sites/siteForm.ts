import { handleFromLabel } from "../content-types/handle.js";
import type { NewSite, Site, SiteChanges } from "./sites.types.js";

/**
 * What the site sheet edits, as people type it: domains as one line of text. Turned into a
 * request here, so the rules are easy to test without a screen.
 */
export interface SiteDraft {
  name: string;
  handle: string;
  /** Whether the handle was typed by hand, so it stops following the name. */
  handleEdited: boolean;
  domains: string;
  pathPrefix: string;
  siteUrl: string;
  defaultLocale: string;
  extraLocales: string[];
  accentColor: string;
}

export function emptySiteDraft(): SiteDraft {
  return {
    name: "",
    handle: "",
    handleEdited: false,
    domains: "",
    pathPrefix: "",
    siteUrl: "",
    defaultLocale: "en-GB",
    extraLocales: [],
    accentColor: "",
  };
}

export function draftFromSite(site: Site): SiteDraft {
  return {
    name: site.name,
    handle: site.handle,
    handleEdited: true,
    domains: site.hostnames.join(", "),
    pathPrefix: site.pathPrefix,
    siteUrl: site.siteUrl,
    defaultLocale: site.defaultLocale,
    extraLocales: [],
    accentColor: site.branding.accentColor ?? "",
  };
}

/** A new name also renames the handle, until someone edits the handle themselves. */
export function renameDraft(draft: SiteDraft, name: string): SiteDraft {
  return {
    ...draft,
    name,
    handle: draft.handleEdited ? draft.handle : handleFromLabel(name, "site"),
  };
}

/** "acme.fr, www.acme.fr" or one per line: each becomes a domain; blanks are dropped. */
export function splitDomains(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map((domain) => domain.trim())
    .filter((domain) => domain !== "");
}

export function newSiteFromDraft(draft: SiteDraft): NewSite {
  return {
    handle: draft.handle,
    name: draft.name.trim(),
    hostnames: splitDomains(draft.domains),
    pathPrefix: draft.pathPrefix.trim(),
    siteUrl: draft.siteUrl.trim(),
    defaultLocale: draft.defaultLocale,
    extraLocales: draft.extraLocales.filter((code) => code !== draft.defaultLocale),
    branding: { accentColor: draft.accentColor.trim() || null },
  };
}

export function siteChangesFromDraft(draft: SiteDraft): SiteChanges {
  const { name, hostnames, pathPrefix, siteUrl, defaultLocale, branding } = newSiteFromDraft(draft);
  return { name, hostnames, pathPrefix, siteUrl, defaultLocale, branding };
}
