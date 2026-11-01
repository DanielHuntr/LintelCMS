import type { AccentShades } from "@lintel/core/accent-colours";
import { apiRequest } from "../api/client.js";

/** Calls to the branding routes (see packages/core/src/branding). */

export interface Branding {
  productName: string;
  logo: string | null;
  logoDark: string | null;
  mark: string | null;
  favicon: string | null;
  accentColour: string;
  signInMessage: string | null;
  signInBackground: string | null;
  supportUrl: string | null;
  supportEmail: string | null;
  docsUrl: string | null;
  hideBuiltWithLintel: boolean;
  hideLintelHelp: boolean;
}

export type BrandingImageField = "logo" | "logoDark" | "mark" | "favicon" | "signInBackground";

/** What every screen uses. Pictures are addresses, ready for `<img src>`. */
export interface PublicBranding extends Branding {
  accent: AccentShades;
  isLintelDefault: boolean;
}

export interface BrandingSettings {
  branding: Branding;
  defaults: Branding;
  defaultsFromDeployment: boolean;
}

export function fetchPublicBranding() {
  return apiRequest<PublicBranding>("/branding");
}

export function fetchBrandingSettings() {
  return apiRequest<BrandingSettings>("/branding/settings");
}

export function saveBranding(branding: Branding) {
  return apiRequest<BrandingSettings>("/branding", { method: "PUT", body: branding });
}

export function resetBranding() {
  return apiRequest<BrandingSettings>("/branding", { method: "DELETE" });
}
