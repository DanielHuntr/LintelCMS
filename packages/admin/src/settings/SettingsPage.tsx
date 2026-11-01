import {
  Archive,
  ArrowUpCircle,
  Blocks,
  FileInput,
  Inbox,
  Info,
  KeyRound,
  Languages,
  MonitorSmartphone,
  Shapes,
  ShieldCheck,
  Sparkles,
  Webhook,
} from "lucide-react";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { t } from "../i18n/strings.js";
import { Page } from "../design/Page.js";
import { PluginSettingsRows } from "../plugins/PluginSettingsRows.js";
import { useCan } from "../session/SessionContext.js";
import { UpdatesCountBadge } from "../updates/UpdatesCountBadge.js";

/**
 * /settings: one row per area of settings, like iOS Settings. Rows appear as their screens
 * are built: content types and features so far.
 */
export function SettingsPage() {
  const canSeeContentTypes = useCan("blueprints:read");
  const canSeeSiteSettings = useCan("settings:read");
  const canSeeSecurityLog = useCan("security:read");
  const canSeeBackups = useCan("backups:read");
  const canTransferContent = useCan("content:transfer");
  const canSeeUpdates = useCan("updates:read");

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
        {(canSeeSecurityLog || canSeeSiteSettings) && (
          <GroupedList header={t("settings.securityHeader")}>
            {canSeeSecurityLog && (
              <GroupedListRow
                icon={ShieldCheck}
                iconTone="success"
                label={t("securityLog.title")}
                description={t("settings.securityLogDescription")}
                to="/settings/security-log"
              />
            )}
            {canSeeSiteSettings && (
              <GroupedListRow
                icon={Inbox}
                iconTone="neutral"
                label={t("emailOutbox.title")}
                description={t("settings.emailOutboxDescription")}
                to="/settings/email-outbox"
              />
            )}
          </GroupedList>
        )}
        <PluginSettingsRows />
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
        <GroupedList header={t("settings.systemHeader")}>
          {canSeeUpdates && (
            <GroupedListRow
              icon={ArrowUpCircle}
              iconTone="success"
              label={t("updates.title")}
              description={t("settings.updatesDescription")}
              accessory={<UpdatesCountBadge />}
              to="/settings/updates"
            />
          )}
          <GroupedListRow
            icon={Info}
            iconTone="neutral"
            label={t("about.title")}
            description={t("settings.aboutDescription")}
            to="/settings/about"
          />
        </GroupedList>
        <GroupedList header={t("settings.siteHeader")} footer={t("settings.moreSoon")}>
          {canSeeSiteSettings && (
            <GroupedListRow
              icon={MonitorSmartphone}
              iconTone="success"
              label={t("website.title")}
              description={t("website.settingsDescription")}
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
