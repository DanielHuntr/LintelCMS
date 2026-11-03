import type { ConsentService } from "./consent-services.js";

/**
 * What a published page tells the cookie notice's script, as JSON in
 * `<script type="application/json" id="lintel-cookie-notice">`. The server works it out
 * (core's src/cookie-notice) and the script (builder's site-behaviours) reads it; the elements
 * script reads the same to know which embeds a visitor has already allowed.
 */
export interface CookieNoticePage {
  /** Where the visitor's choice is kept in localStorage, one per site: "lintel-consent:<id>". */
  storageKey: string;
  /** Changes whenever the list of services does, so visitors are asked again. */
  version: string;
  services: ConsentService[];
  position: "bar" | "corner";
  heading: string;
  /** With the services' names already in it. */
  message: string;
  /** The site's privacy page, linked from the notice, or null. */
  privacyUrl: string | null;
  /** Stylesheets that may only be linked once their service is allowed (Adobe Fonts'). */
  fontStylesheets: string[];
  labels: CookieNoticeLabels;
}

/** The notice's own words besides the heading and message. English unless a site passes others. */
export interface CookieNoticeLabels {
  acceptAll: string;
  onlyNecessary: string;
  choose: string;
  save: string;
  privacy: string;
  /** Read out for the list of switches: "Choose what can load". */
  servicesList: string;
}

export const englishCookieNoticeLabels: CookieNoticeLabels = {
  acceptAll: "Accept all",
  onlyNecessary: "Only necessary",
  choose: "Choose",
  save: "Save my choices",
  privacy: "Privacy",
  servicesList: "Choose what can load",
};

/** The id of the element the page's notice settings are in. */
export const cookieNoticeElementId = "lintel-cookie-notice";

/** How long a visitor's choice is kept before they are asked again: about six months. */
export const consentLifetimeDays = 182;

/** The services' ids in one stable string: the version a visitor's choice was made for. */
export function consentVersion(services: readonly Pick<ConsentService, "id">[]): string {
  return services
    .map((service) => service.id)
    .sort()
    .join(" ");
}
