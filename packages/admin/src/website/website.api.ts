import { apiRequest } from "../api/client.js";

/** Calls to the built-in website's settings (see packages/core/src/website). */

export type ColourScheme = "light" | "dark" | "auto";
export type CornerStyle = "square" | "soft" | "round";
export type SpacingScale = "compact" | "comfortable" | "airy";

export interface SiteTheme {
  brandColour: string;
  accentColour: string;
  fontPairing: string;
  cornerStyle: CornerStyle;
  spacing: SpacingScale;
  colourScheme: ColourScheme;
}

export interface SiteTemplateSummary {
  id: string;
  name: string;
  description: string;
  defaultTheme: SiteTheme;
}

export interface Website {
  template: string;
  theme: SiteTheme;
  logoAssetId: string | null;
  /** What was typed; empty means the built-in site's address. */
  siteAddress: string;
  effectiveSiteAddress: string | null;
  builtInSiteUrl: string | null;
  templates: SiteTemplateSummary[];
  fontPairings: Array<{ id: string; name: string; description: string }>;
}

export type WebsiteChanges = Partial<SiteTheme> & {
  template?: string;
  logoAssetId?: string | null;
  siteAddress?: string;
};

export interface SiteAddress {
  siteAddress: string | null;
  defaultLocale: string;
}

export function getWebsite() {
  return apiRequest<Website>("/website");
}

export function updateWebsite(changes: WebsiteChanges) {
  return apiRequest<Website>("/website", { method: "PUT", body: changes });
}

export function getSiteAddress() {
  return apiRequest<SiteAddress>("/website/address");
}

/** What the page builder draws its canvas with, so pages look exactly as on the website. */
export interface CanvasSite {
  stylesheet: string;
  bodyClassName: string;
  headerHtml: string;
  footerHtml: string;
  baseUrl: string | null;
  motionScript: string;
}

export function getCanvasSite() {
  return apiRequest<CanvasSite>("/website/canvas");
}
