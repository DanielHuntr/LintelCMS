import { Globe, Puzzle, Shapes } from "lucide-react";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";

/**
 * /settings: one row per area of settings, like iOS Settings. Rows appear as their screens
 * are built: content types and features so far.
 */
export function SettingsPage() {
  const canSeeContentTypes = useCan("blueprints:read");
  const canSeeFeatures = useCan("settings:read");

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
        <GroupedList header={t("settings.siteHeader")} footer={t("settings.moreSoon")}>
          {canSeeFeatures && (
            <GroupedListRow
              icon={Puzzle}
              label={t("features.title")}
              description={t("settings.featuresDescription")}
              to="/settings/features"
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
