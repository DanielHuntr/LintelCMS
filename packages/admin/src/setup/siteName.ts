import { t } from "../i18n/strings.js";

/** Matches the API's rule (`siteNameSchema` in core's settings.schema.ts). */
export const maximumSiteNameLength = 80;

/** What to fix about a site name, or undefined when it's fine. Checked on the trimmed name. */
export function siteNameProblem(siteName: string): string | undefined {
  const trimmed = siteName.trim();
  if (!trimmed) return t("siteName.missing");
  if (trimmed.length > maximumSiteNameLength) {
    return t("siteName.tooLong", { maximum: maximumSiteNameLength });
  }
  return undefined;
}
