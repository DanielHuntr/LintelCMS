import type { CookieNoticePage } from "@lintel/builder-model";

/**
 * A visitor's cookie choice, shared by the cookie notice's script and the elements script:
 * which services they allowed, kept in localStorage (not a cookie) per site for about six
 * months, and only while the site's list of services stays the same. Pages without the
 * notice have no settings, and nothing is ever allowed by itself there.
 *
 * Plugins' own scripts can ask too: `window.lintelConsent.allows("plugin:bookings")`, and
 * listen for the `lintel:consent` event on `document`.
 */

/** Matches `cookieNoticeElementId` and `consentLifetimeDays` in @lintel/builder-model. */
export const noticeElementId = "lintel-cookie-notice";
export const lifetimeDays = 182;
export const consentEventName = "lintel:consent";

const dayInMilliseconds = 24 * 60 * 60 * 1000;

export interface SavedChoice {
  version: string;
  allowed: string[];
  /** When it was made, in milliseconds since 1970. */
  decidedAt: number;
}

/** The page's notice settings, or null on a page without the notice. */
export function readNoticePage(document: Document): CookieNoticePage | null {
  const element = document.getElementById(noticeElementId);
  if (!element?.textContent) return null;
  try {
    const parsed = JSON.parse(element.textContent) as CookieNoticePage;
    return typeof parsed.storageKey === "string" && Array.isArray(parsed.services) ? parsed : null;
  } catch {
    return null;
  }
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The visitor's choice for this site, or null when they haven't made one that still counts. */
export function readChoice(page: CookieNoticePage, now = Date.now()): SavedChoice | null {
  const stored = storage()?.getItem(page.storageKey);
  if (!stored) return null;
  try {
    const choice = JSON.parse(stored) as SavedChoice;
    if (choice.version !== page.version || !Array.isArray(choice.allowed)) return null;
    if (!(now - choice.decidedAt < lifetimeDays * dayInMilliseconds)) return null;
    if (choice.decidedAt > now + dayInMilliseconds) return null;
    return choice;
  } catch {
    return null;
  }
}

/** Keeps a choice, telling the rest of the page which services may now load. */
export function saveChoice(page: CookieNoticePage, allowed: readonly string[], now = Date.now()) {
  const known = new Set(page.services.map((service) => service.id));
  const choice: SavedChoice = {
    version: page.version,
    allowed: allowed.filter((id) => known.has(id)),
    decidedAt: now,
  };
  try {
    storage()?.setItem(page.storageKey, JSON.stringify(choice));
  } catch {
    // Private windows may refuse; the choice still counts for this page.
  }
  document.dispatchEvent(
    new CustomEvent(consentEventName, { detail: { allowed: [...choice.allowed] } }),
  );
  return choice;
}

/** The services the visitor allowed on this page: none on a page without the notice. */
export function allowedServices(document: Document): Set<string> {
  const page = readNoticePage(document);
  return new Set(page ? (readChoice(page)?.allowed ?? []) : []);
}

/** Calls back with the allowed services each time the visitor makes a choice. */
export function onConsentChange(callback: (allowed: Set<string>) => void): void {
  document.addEventListener(consentEventName, (event) => {
    const detail = (event as CustomEvent<{ allowed?: unknown }>).detail;
    const allowed = Array.isArray(detail?.allowed) ? detail.allowed : [];
    callback(new Set(allowed.filter((id): id is string => typeof id === "string")));
  });
}
