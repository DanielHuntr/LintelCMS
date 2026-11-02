import {
  Archive,
  ArrowUpCircle,
  Blocks,
  Globe,
  FileInput,
  Inbox,
  Info,
  KeyRound,
  Languages,
  MonitorSmartphone,
  Palette,
  Shapes,
  ShieldCheck,
  Type,
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
 * /settings: one row per area of settings, like iOS Settings. The website's own settings come
 * first, as what most owners come here for; developer and system settings come last.
 */
export function SettingsPage() {
  const canSeeContentTypes = useCan("blueprints:read");
  const canSeeSiteSettings = useCan("settings:read");
  const canSeeSecurityLog = useCan("security:read");
  const canBrand = useCan("branding:update");
  const canSeeBackups = useCan("backups:read");
  const canTransferContent = useCan("content:transfer");
  const canSeeUpdates = useCan("updates:read");
  // The outbox holds other people's sign-in links, so only owners can read it.
  const canReadOutbox = useCan("*");

  return (
    <Page width="readable">
      <LargeTitle title={t("settings.title")} subtitle={t("settings.subtitle")} />
      <div className="flex flex-col gap-8">
        {canSeeSiteSettings && (
          <GroupedList header={t("settings.siteHeader")}>
            <GroupedListRow
              icon={MonitorSmartphone}
              iconTone="success"
              label={t("website.title")}
              description={t("website.settingsDescription")}
              to="/settings/site"
            />
            <GroupedListRow
              icon={Blocks}
              iconTone="accent"
              label={t("features.title")}
              description={t("settings.featuresDescription")}
              to="/settings/features"
            />
            <GroupedListRow
              icon={Globe}
              iconTone="accent"
              label={t("sites.title")}
              description={t("settings.sitesDescription")}
              to="/settings/sites"
            />
            <GroupedListRow
              icon={Languages}
              label={t("languages.title")}
              description={t("settings.languagesDescription")}
              to="/settings/languages"
            />
          </GroupedList>
        )}
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
        <GroupedList header={t("settings.yourAdminHeader")}>
          <GroupedListRow
            icon={Type}
            iconTone="neutral"
            label={t("interfaceLanguage.title")}
            description={t("settings.interfaceLanguageDescription")}
            to="/settings/interface-language"
          />
          {canBrand && (
            <GroupedListRow
              icon={Palette}
              label={t("branding.title")}
              description={t("settings.brandingDescription")}
              to="/settings/branding"
            />
          )}
        </GroupedList>
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
        {(canSeeSecurityLog || canReadOutbox) && (
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
            {canReadOutbox && (
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
      </div>
    </Page>
  );
}
