import {
  Blocks,
  FileInput,
  Globe,
  KeyRound,
  Palette,
  Shapes,
  Webhook,
  type LucideIcon,
} from "lucide-react";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { Page } from "../design/Page.js";
import type { Tone } from "../design/tones.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";

interface BuildRow {
  key: string;
  icon: LucideIcon;
  label: string;
  description: string;
  to: string;
}

interface BuildGroup {
  header: string;
  tone: Tone;
  rows: BuildRow[];
}

/**
 * /build: how the site is put together, for whoever built it. These used to sit in Settings
 * among the things a website owner changes, where changing them by mistake could break the
 * site. Only people allowed to change the site's structure see Build (see navigation/sections).
 */
export function BuildPage() {
  const groups = useBuildGroups().filter((group) => group.rows.length > 0);

  return (
    <Page width="readable">
      <LargeTitle title={t("build.title")} subtitle={t("build.subtitle")} />
      <div className="flex flex-col gap-8">
        {groups.map((group) => (
          <GroupedList key={group.header} header={group.header}>
            {group.rows.map(({ key, ...row }) => (
              <GroupedListRow key={key} iconTone={group.tone} wrapsText {...row} />
            ))}
          </GroupedList>
        ))}
      </div>
    </Page>
  );
}

function useBuildGroups(): BuildGroup[] {
  const canSeeContentTypes = useCan("blueprints:read");
  const canSeeSiteSettings = useCan("settings:read");
  const canBrand = useCan("branding:update");
  const canTransferContent = useCan("content:transfer");

  const when = (condition: boolean, row: BuildRow) => (condition ? [row] : []);
  return [
    {
      header: t("build.structureHeader"),
      tone: "accent",
      rows: [
        ...when(canSeeContentTypes, {
          key: "content-types",
          icon: Shapes,
          label: t("contentTypes.title"),
          description: t("settings.contentTypesDescription"),
          to: "/build/content-types",
        }),
        ...when(canSeeSiteSettings, {
          key: "features",
          icon: Blocks,
          label: t("features.title"),
          description: t("settings.featuresDescription"),
          to: "/build/features",
        }),
      ],
    },
    {
      header: t("build.websitesHeader"),
      tone: "success",
      rows: [
        ...when(canSeeSiteSettings, {
          key: "sites",
          icon: Globe,
          label: t("sites.title"),
          description: t("settings.sitesDescription"),
          to: "/build/sites",
        }),
        ...when(canBrand, {
          key: "branding",
          icon: Palette,
          label: t("branding.title"),
          description: t("settings.brandingDescription"),
          to: "/build/branding",
        }),
      ],
    },
    {
      header: t("build.connectingHeader"),
      tone: "neutral",
      rows: [
        ...when(canSeeSiteSettings, {
          key: "api",
          icon: KeyRound,
          label: t("apiAccess.title"),
          description: t("settings.apiAccessDescription"),
          to: "/build/api",
        }),
        ...when(canSeeSiteSettings, {
          key: "webhooks",
          icon: Webhook,
          label: t("webhooks.title"),
          description: t("settings.webhooksDescription"),
          to: "/build/webhooks",
        }),
        ...when(canTransferContent, {
          key: "import",
          icon: FileInput,
          label: t("import.title"),
          description: t("settings.importDescription"),
          to: "/build/import",
        }),
      ],
    },
  ];
}
