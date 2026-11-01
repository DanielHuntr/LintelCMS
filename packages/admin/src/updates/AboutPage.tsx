import { BookOpen, RefreshCw } from "lucide-react";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { Page } from "../design/Page.js";
import { t, type StringKey } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { useAbout, useUpdates } from "./updates.queries.js";

/** /settings/about: which version of Lintel this is, how it was installed, and help. */
export function AboutPage() {
  const about = useAbout();
  const canSeeUpdates = useCan("updates:read");

  return (
    <Page width="readable">
      <BackLink to="/settings">{t("nav.settings")}</BackLink>
      <LargeTitle title={t("about.title")} subtitle={t("about.license")} />
      {about.isError && <LoadError error={about.error} onRetry={() => void about.refetch()} />}
      <div className="flex flex-col gap-8">
        <GroupedList>
          <GroupedListRow label={t("about.version")} detail={about.data?.version ?? "…"} />
          {canSeeUpdates && <InstallTypeRow />}
        </GroupedList>
        <GroupedList>
          {canSeeUpdates && (
            <GroupedListRow
              icon={RefreshCw}
              iconTone="success"
              label={t("about.updates")}
              to="/settings/updates"
            />
          )}
          <GroupedListRow icon={BookOpen} label={t("about.help")} to="/help" />
        </GroupedList>
      </div>
    </Page>
  );
}

function InstallTypeRow() {
  const updates = useUpdates();
  const installType = updates.data?.method.installType;
  return (
    <GroupedListRow
      label={t("about.installType")}
      detail={installType ? t(`about.installType.${installType}` as StringKey) : "…"}
    />
  );
}
