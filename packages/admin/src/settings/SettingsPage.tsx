import {
  Archive,
  ArrowUpCircle,
  CornerDownRight,
  Info,
  Languages,
  MonitorSmartphone,
  Search,
  Server,
  UploadCloud,
} from "lucide-react";
import { useState } from "react";
import { EmptyState } from "../design/EmptyState.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { Page } from "../design/Page.js";
import { SearchField } from "../design/SearchField.js";
import { t } from "../i18n/strings.js";
import { movedPages } from "../navigation/movedPages.js";
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
 * /settings: the things a website owner changes now and then, like iOS Settings, with a
 * search box. What the site is built from is in Build, the security log and sent emails are
 * in Users, and your own language for the admin is on Account; searching here for one of
 * those says where it went. Rows people may not use aren't shown.
 */
export function SettingsPage() {
  const groups = useSettingsGroups();
  const [search, setSearch] = useState("");
  const shown = searchSettings(groups, search);
  const moved = searchSettings([{ header: "", entries: movedEntries() }], search);
  const movedShown = search.trim() === "" ? [] : (moved[0]?.entries ?? []);

  return (
    <Page width="readable">
      <LargeTitle title={t("settings.title")} subtitle={t("settings.subtitle")} />
      <div className="flex flex-col gap-8">
        <SearchField label={t("settings.search")} value={search} onValueChange={setSearch} />
        {shown.map((group) => (
          <GroupedList key={group.header} header={group.header} footer={group.footer}>
            {group.entries.map(({ key, ...entry }) => (
              <GroupedListRow key={key} wrapsText {...entry} />
            ))}
          </GroupedList>
        ))}
        {movedShown.length > 0 && (
          <GroupedList header={t("settings.movedHeader")}>
            {movedShown.map(({ key, ...entry }) => (
              <GroupedListRow key={key} wrapsText {...entry} />
            ))}
          </GroupedList>
        )}
        {shown.length === 0 && movedShown.length === 0 && (
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

/** Rows for screens that used to be here, found by their name: "Webhooks is now in Build". */
function movedEntries(): SettingsEntry[] {
  return movedPages.map((page) => ({
    key: page.from,
    icon: CornerDownRight,
    iconTone: "neutral",
    label: t(page.label),
    description: t("settings.movedTo", { name: t(page.label), place: t(page.nowIn) }),
    to: page.to,
  }));
}

function useSettingsGroups(): SettingsGroup[] {
  const canSeeSiteSettings = useCan("settings:read");
  const canSeeBackups = useCan("backups:read");
  const canSeeUpdates = useCan("updates:read");
  const pluginRows = useVisibleContributions("settingsRows");

  const when = (condition: boolean, entry: SettingsEntry) => (condition ? [entry] : []);

  // Each group has one icon colour, so the colour says which kind of setting a row is.
  return arrangeSettings(
    [
      {
        header: t("settings.siteHeader"),
        entries: [
          ...when(canSeeSiteSettings, {
            key: "site",
            icon: MonitorSmartphone,
            iconTone: "accent",
            label: t("settings.websiteRow"),
            description: t("website.settingsDescription"),
            to: "/settings/site",
          }),
          ...when(canSeeSiteSettings, {
            key: "languages",
            icon: Languages,
            iconTone: "accent",
            label: t("languages.title"),
            description: t("settings.languagesDescription"),
            to: "/settings/languages",
          }),
          ...when(canSeeSiteSettings, {
            key: "publishing",
            icon: UploadCloud,
            iconTone: "accent",
            label: t("publishing.title"),
            description: t("publishing.settingsDescription"),
            to: "/settings/publishing",
          }),
        ],
      },
      {
        header: t("settings.lookingAfterHeader"),
        entries: [
          ...when(canSeeBackups, {
            key: "backups",
            icon: Archive,
            iconTone: "success",
            label: t("backups.title"),
            description: t("settings.backupsDescription"),
            to: "/settings/backups",
          }),
          ...when(canSeeUpdates, {
            key: "updates",
            icon: ArrowUpCircle,
            iconTone: "success",
            label: t("updates.title"),
            description: t("settings.updatesDescription"),
            accessory: <UpdatesCountBadge />,
            to: "/settings/updates",
          }),
          ...when(canSeeUpdates, {
            key: "server",
            icon: Server,
            iconTone: "success",
            label: t("serverCheck.title"),
            description: t("serverCheck.settingsDescription"),
            to: "/settings/server",
          }),
          {
            key: "about",
            icon: Info,
            iconTone: "success",
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
      iconTone: "accent",
      label: row.label,
      description: row.description,
      to: row.to,
    })),
  );
}
