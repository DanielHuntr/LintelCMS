import { apiRequest } from "../api/client.js";

/** Calls to the interface language routes (see packages/core/src/interface-languages). */

export interface InterfaceLanguageChoice {
  /** What the signed-in person chose, or null to follow the site's default. */
  personal: string | null;
  siteDefault: string;
  /** The one to show. */
  active: string;
}

export function fetchInterfaceLanguage() {
  return apiRequest<InterfaceLanguageChoice>("/interface-language");
}

export function choosePersonalLanguage(language: string | null) {
  return apiRequest<InterfaceLanguageChoice>("/interface-language", {
    method: "PUT",
    body: { language },
  });
}

export function chooseSiteDefaultLanguage(language: string | null) {
  return apiRequest<InterfaceLanguageChoice>("/interface-language/site-default", {
    method: "PUT",
    body: { language },
  });
}
