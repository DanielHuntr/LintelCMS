import {
  Archive,
  FileInput,
  Globe,
  KeyRound,
  Languages,
  Search,
  Shapes,
  Webhook,
} from "lucide-react";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { t } from "../i18n/strings.js";
import { useCan, useSession } from "../session/SessionContext.js";

/**
 * /settings: one row per area of settings, like iOS Settings. Rows appear as their screens
 * are built; for now that's content types.
 */
export function SettingsPage() {
  const canSeeContentTypes = useCan("blueprints:read");
  const canSeeSiteSettings = useCan("settings:read");
  const { enabledPlugins } = useSession();
  const canSeeBackups = useCan("backups:read");
  const canTransferContent = useCan("content:transfer");

  return (
    <>
      <LargeTitle title={t("settings.title")} subtitle={t("settings.subtitle")} />
      <div className="flex max-w-2xl flex-col gap-8">
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
        {canSeeSiteSettings && enabledPlugins.includes("seo") && (
          <GroupedList header={t("settings.searchHeader")}>
            <GroupedListRow
              icon={Search}
              iconTone="success"
              label={t("seo.settingsTitle")}
              description={t("settings.seoDescription")}
              to="/settings/seo"
            />
          </GroupedList>
        )}
        {(canSeeBackups || canTransferContent) && (
          <GroupedList header={t("settings.dataHeader")}>
            {canSeeBackups && (
              <GroupedListRow
                icon={Archive}
                iconTone="success"
                label={t("backups.title")}
                description={t("settings.backupsDescription")}
                to="/settings/backups"
              />
            )}
            {canTransferContent && (
              <GroupedListRow
                icon={FileInput}
                label={t("import.title")}
                description={t("settings.importDescription")}
                to="/settings/import"
              />
            )}
          </GroupedList>
        )}
        <GroupedList header={t("settings.siteHeader")} footer={t("settings.moreSoon")}>
          {canSeeSiteSettings && (
            <GroupedListRow
              icon={Languages}
              label={t("languages.title")}
              description={t("settings.languagesDescription")}
              to="/settings/languages"
            />
          )}
          <GroupedListRow
            icon={Globe}
            iconTone="neutral"
            label={t("settings.moreSoonTitle")}
            description={t("section.comingSoon")}
          />
        </GroupedList>
      </div>
    </>
  );
}
