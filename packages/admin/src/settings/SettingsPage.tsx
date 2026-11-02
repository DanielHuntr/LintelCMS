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
  Search,
  Shapes,
  ShieldCheck,
  Type,
  Webhook,
} from "lucide-react";
import { useState } from "react";
import { EmptyState } from "../design/EmptyState.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { Page } from "../design/Page.js";
import { SearchField } from "../design/SearchField.js";
import { t } from "../i18n/strings.js";
import { useVisibleContributions } from "../plugins/AdminPluginsContext.js";
import { useCan } from "../session/SessionContext.js";
import { UpdatesCountBadge } from "../updates/UpdatesCountBadge.js";
import {
  arrangeSettings,
  type SettingsEntry,
  type SettingsGroup,
  searchSettings,
} from "./settingsGroups.js";

/**
 * /settings: one row per area of settings, like iOS Settings, with a search box. The
 * website's own settings come first, as what most owners come here for; developer and system
 * settings come last. Rows people may not use aren't shown.
 */
export function SettingsPage() {
  const groups = useSettingsGroups();
  const [search, setSearch] = useState("");
  const shown = searchSettings(groups, search);

  return (
    <Page width="readable">
      <LargeTitle title={t("settings.title")} subtitle={t("settings.subtitle")} />
      <div className="flex flex-col gap-8">
        <SearchField label={t("settings.search")} value={search} onValueChange={setSearch} />
        {shown.map((group) => (
          <GroupedList key={group.header} header={group.header}>
            {group.entries.map(({ key, ...entry }) => (
              <GroupedListRow key={key} {...entry} />
            ))}
          </GroupedList>
        ))}
        {shown.length === 0 && (
          <div className="rounded-card bg-surface">
            <EmptyState
              icon={Search}
              title={t("settings.searchEmptyTitle")}
              description={t("settings.searchEmptyDescription", { search: search.trim() })}
            />
          </div>
        )}
      </div>
    </Page>
  );
}

function useSettingsGroups(): SettingsGroup[] {
  const canSeeContentTypes = useCan("blueprints:read");
  const canSeeSiteSettings = useCan("settings:read");
  const canSeeSecurityLog = useCan("security:read");
  const canBrand = useCan("branding:update");
  const canSeeBackups = useCan("backups:read");
  const canTransferContent = useCan("content:transfer");
  const canSeeUpdates = useCan("updates:read");
  // The outbox holds other people's sign-in links, so only owners can read it.
  const canReadOutbox = useCan("*");
  const pluginRows = useVisibleContributions("settingsRows");

  const when = (condition: boolean, entry: SettingsEntry) => (condition ? [entry] : []);
  const site: SettingsEntry[] = [
    ...when(canSeeSiteSettings, {
      key: "site",
      icon: MonitorSmartphone,
      iconTone: "success",
      label: t("website.title"),
      description: t("website.settingsDescription"),
      to: "/settings/site",
    }),
    ...when(canSeeContentTypes, {
      key: "content-types",
      icon: Shapes,
      label: t("contentTypes.title"),
      description: t("settings.contentTypesDescription"),
      to: "/settings/content-types",
    }),
    ...when(canSeeSiteSettings, {
      key: "features",
      icon: Blocks,
      iconTone: "accent",
      label: t("features.title"),
      description: t("settings.featuresDescription"),
      to: "/settings/features",
    }),
    ...when(canSeeSiteSettings, {
      key: "sites",
      icon: Globe,
      iconTone: "accent",
      label: t("sites.title"),
      description: t("settings.sitesDescription"),
      to: "/settings/sites",
    }),
    ...when(canSeeSiteSettings, {
      key: "languages",
      icon: Languages,
      label: t("languages.title"),
      description: t("settings.languagesDescription"),
      to: "/settings/languages",
    }),
  ];

  return arrangeSettings(
    [
      { header: t("settings.siteHeader"), entries: site },
      {
        header: t("settings.yourAdminHeader"),
        entries: [
          {
            key: "interface-language",
            icon: Type,
            iconTone: "neutral",
            label: t("interfaceLanguage.title"),
            description: t("settings.interfaceLanguageDescription"),
            to: "/settings/interface-language",
          },
          ...when(canBrand, {
            key: "branding",
            icon: Palette,
            label: t("branding.title"),
            description: t("settings.brandingDescription"),
            to: "/settings/branding",
          }),
        ],
      },
      {
        header: t("settings.dataHeader"),
        entries: [
          ...when(canSeeBackups, {
            key: "backups",
            icon: Archive,
            iconTone: "success",
            label: t("backups.title"),
            description: t("settings.backupsDescription"),
            to: "/settings/backups",
          }),
          ...when(canTransferContent, {
            key: "import",
            icon: FileInput,
            label: t("import.title"),
            description: t("settings.importDescription"),
            to: "/settings/import",
          }),
        ],
      },
      {
        header: t("settings.securityHeader"),
        entries: [
          ...when(canSeeSecurityLog, {
            key: "security-log",
            icon: ShieldCheck,
            iconTone: "success",
            label: t("securityLog.title"),
            description: t("settings.securityLogDescription"),
            to: "/settings/security-log",
          }),
          ...when(canReadOutbox, {
            key: "email-outbox",
            icon: Inbox,
            iconTone: "neutral",
            label: t("emailOutbox.title"),
            description: t("settings.emailOutboxDescription"),
            to: "/settings/email-outbox",
          }),
        ],
      },
      {
        header: t("settings.developersHeader"),
        entries: [
          ...when(canSeeSiteSettings, {
            key: "api",
            icon: KeyRound,
            iconTone: "warning",
            label: t("apiAccess.title"),
            description: t("settings.apiAccessDescription"),
            to: "/settings/api",
          }),
          ...when(canSeeSiteSettings, {
            key: "webhooks",
            icon: Webhook,
            label: t("webhooks.title"),
            description: t("settings.webhooksDescription"),
            to: "/settings/webhooks",
          }),
        ],
      },
      {
        header: t("settings.systemHeader"),
        entries: [
          ...when(canSeeUpdates, {
            key: "updates",
            icon: ArrowUpCircle,
            iconTone: "success",
            label: t("updates.title"),
            description: t("settings.updatesDescription"),
            accessory: <UpdatesCountBadge />,
            to: "/settings/updates",
          }),
          {
            key: "about",
            icon: Info,
            iconTone: "neutral",
            label: t("about.title"),
            description: t("settings.aboutDescription"),
            to: "/settings/about",
          },
        ],
      },
    ],
    pluginRows.map((row) => ({
      key: `${row.pluginId}:${row.to}`,
      group: row.group,
      icon: row.icon,
      iconTone: "success",
      label: row.label,
      description: row.description,
      to: row.to,
    })),
  );
}
