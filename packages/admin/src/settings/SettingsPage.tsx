import { Blocks, Globe, KeyRound, Languages, Shapes, Sparkles, Webhook } from "lucide-react";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { t } from "../i18n/strings.js";
import { Page } from "../design/Page.js";
import { PluginSettingsRows } from "../plugins/PluginSettingsRows.js";
import { useCan } from "../session/SessionContext.js";

/**
 * /settings: one row per area of settings, like iOS Settings. Rows appear as their screens
 * are built: content types and features so far.
 */
export function SettingsPage() {
  const canSeeContentTypes = useCan("blueprints:read");
  const canSeeSiteSettings = useCan("settings:read");

  return (
    <Page width="readable">
      <LargeTitle title={t("settings.title")} subtitle={t("settings.subtitle")} />
      <div className="flex flex-col gap-8">
        {canSeeContentTypes && (
          <GroupedList header={t("settings.contentHeader")}>
            <GroupedListRow
              icon={Shapes}
              label={t("contentTypes.title")}
              description={t("settings.contentTypesDescription")}
              to="/settings/content-types"
            />
          </GroupedList>
        )}
        {canSeeSiteSettings && (
          <GroupedList header={t("settings.developersHeader")}>
            <GroupedListRow
              icon={KeyRound}
              iconTone="warning"
              label={t("apiAccess.title")}
              description={t("settings.apiAccessDescription")}
              to="/settings/api"
            />
            <GroupedListRow
              icon={Webhook}
              label={t("webhooks.title")}
              description={t("settings.webhooksDescription")}
              to="/settings/webhooks"
            />
          </GroupedList>
        )}
        <PluginSettingsRows />
        <GroupedList header={t("settings.siteHeader")} footer={t("settings.moreSoon")}>
          {canSeeSiteSettings && (
            <GroupedListRow
              icon={Globe}
              label={t("siteSettings.title")}
              description={t("settings.siteDescription")}
              to="/settings/site"
            />
          )}
          {canSeeSiteSettings && (
            <GroupedListRow
              icon={Blocks}
              iconTone="accent"
              label={t("features.title")}
              description={t("settings.featuresDescription")}
              to="/settings/features"
            />
          )}
          {canSeeSiteSettings && (
            <GroupedListRow
              icon={Languages}
              label={t("languages.title")}
              description={t("settings.languagesDescription")}
              to="/settings/languages"
            />
          )}
          <GroupedListRow
            icon={Sparkles}
            iconTone="neutral"
            label={t("settings.moreSoonTitle")}
            description={t("section.comingSoon")}
          />
        </GroupedList>
      </div>
    </Page>
  );
}
