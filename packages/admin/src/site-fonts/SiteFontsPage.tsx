import { BackLink } from "../design/BackLink.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { SiteFontsManager } from "./SiteFontsManager.js";

/** /settings/site/fonts: the fonts every page of the current site can use. */
export function SiteFontsPage() {
  const canChange = useCan("settings:update");
  return (
    <>
      <BackLink to="/settings/site">{t("website.title")}</BackLink>
      <LargeTitle title={t("siteFonts.title")} subtitle={t("siteFonts.subtitle")} />
      <div className="max-w-2xl">
        <SiteFontsManager canChange={canChange} />
      </div>
    </>
  );
}
