/**
 * How a page's title for search engines is built, shared by the API and the admin's
 * search preview so the two always agree. Exported as `@lintel/core/seo-titles`.
 */

/** Search engines show about 60 characters of a title and 160 of a description. */
export const RECOMMENDED_TITLE_LENGTH = 60;
export const RECOMMENDED_DESCRIPTION_LENGTH = 160;
/** Shorter than this and a description rarely says enough to earn the click. */
export const SHORTEST_USEFUL_DESCRIPTION_LENGTH = 50;

/**
 * Fills in "{title} | {siteName}". Without a site name, the separator next to
 * {siteName} goes too, so the result is "About us" rather than "About us | ".
 */
export function applyTitleTemplate(template: string, title: string, siteName: string): string {
  // A page named after the site would otherwise read "Acme | Acme".
  const showSiteName = siteName.trim() !== "" && siteName.trim() !== title.trim();
  const withSite = !showSiteName
    ? template
        .replace(/\s*[|·•:–—-]\s*\{siteName\}/g, "")
        .replace(/\{siteName\}\s*[|·•:–—-]\s*/g, "")
        .replaceAll("{siteName}", "")
    : template.replaceAll("{siteName}", siteName.trim());
  return withSite.replaceAll("{title}", title.trim()).trim();
}

export type LengthAdvice = "missing" | "short" | "good" | "long";

/** Whether a title is likely to be shown whole. */
export function adviseTitleLength(title: string): LengthAdvice {
  const length = title.trim().length;
  if (length === 0) return "missing";
  if (length < 15) return "short";
  return length > RECOMMENDED_TITLE_LENGTH ? "long" : "good";
}

/** Whether a description is long enough to be useful and short enough to be shown whole. */
export function adviseDescriptionLength(description: string): LengthAdvice {
  const length = description.trim().length;
  if (length === 0) return "missing";
  if (length < SHORTEST_USEFUL_DESCRIPTION_LENGTH) return "short";
  return length > RECOMMENDED_DESCRIPTION_LENGTH ? "long" : "good";
}
