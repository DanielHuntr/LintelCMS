import { accentShades, LINTEL_ACCENT_COLOUR } from "@lintel/core/accent-colours";
import type { PublicBranding } from "./branding.api.js";

/** Lintel's own look, used until the server says otherwise (or if it can't be reached). */
export const lintelPublicBranding: PublicBranding = {
  productName: "Lintel",
  logo: null,
  logoDark: null,
  mark: null,
  favicon: null,
  accentColour: LINTEL_ACCENT_COLOUR,
  signInMessage: null,
  signInBackground: null,
  supportUrl: null,
  supportEmail: null,
  docsUrl: null,
  hideBuiltWithLintel: false,
  hideLintelHelp: false,
  accent: accentShades(LINTEL_ACCENT_COLOUR),
  isLintelDefault: true,
};
