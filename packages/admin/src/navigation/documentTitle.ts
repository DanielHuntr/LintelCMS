import { t } from "../i18n/strings.js";
import { sections } from "./sections.js";

/**
 * The browser tab's title for an admin page: the section it's in, then the site's name, so
 * someone with several sites open can tell the tabs apart. "Dashboard · Brightside Bakery".
 * Before the site has a name, the app's name stands in.
 */
export function documentTitleFor(pathname: string, siteName: string | null): string {
  const section = sections
    .filter(({ path }) => (path === "/" ? pathname === "/" : isWithin(pathname, path)))
    .at(-1);
  const site = siteName ?? t("app.name");
  return section ? t("documentTitle.page", { page: t(section.label), site }) : site;
}

function isWithin(pathname: string, sectionPath: string): boolean {
  return pathname === sectionPath || pathname.startsWith(`${sectionPath}/`);
}
