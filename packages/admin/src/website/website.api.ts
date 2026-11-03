import type { SiteDesign } from "@lintel/builder-model";
import type { SiteEffectSettings } from "@lintel/motion";
import type { BuilderDataSources } from "@lintel/builder";
import { apiRequest } from "../api/client.js";
import type { FontCategory } from "../site-fonts/siteFonts.api.js";

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
  /** A font family for headings or body text in place of the pairing's; null follows the pairing. */
  headingFont: string | null;
  bodyFont: string | null;
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
  headingFont?: string | null;
  bodyFont?: string | null;
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

/** Page transitions, cursor and intro across the website (see SiteMotionSettings). */
export function getSiteEffects() {
  return apiRequest<SiteEffectSettings>("/website/effects");
}

export function updateSiteEffects(changes: Partial<SiteEffectSettings>) {
  return apiRequest<SiteEffectSettings>("/website/effects", { method: "PUT", body: changes });
}

/** The site's design variables and shared styles, made in the page builder. */
export function getSiteDesign() {
  return apiRequest<SiteDesign>("/website/design");
}

export function updateSiteDesign(design: SiteDesign) {
  return apiRequest<SiteDesign>("/website/design", { method: "PUT", body: design });
}

/** What the page builder draws its canvas with, so pages look exactly as on the website. */
export interface CanvasSite {
  stylesheet: string;
  bodyClassName: string;
  headerHtml: string;
  footerHtml: string;
  baseUrl: string | null;
  motionScript: string;
  /** For Header and Footer elements on the canvas. */
  siteName: string;
  logo: { src: string; alt: string; width: number | null; height: number | null } | null;
  socialLinks: string[];
  footerText: string;
  /** The site's own fonts, for the builder's font list. */
  fonts: Array<{ family: string; category: FontCategory; source: "upload" | "google" | "adobe" }>;
  /** Adobe Fonts' stylesheet, linked on the canvas as on the website. */
  fontStylesheets: string[];
}

export function getCanvasSite() {
  return apiRequest<CanvasSite>("/website/canvas");
}

/**
 * The site's collections, forms and products, for the builder's collection lists and shop
 * elements (`BuilderDataSources` from `@lintel/builder`).
 */
export function getBuilderData() {
  return apiRequest<BuilderDataSources>("/website/builder-data");
}
