import { Building2, Clock, Database, FileText } from "lucide-react";
import { BackLink } from "../design/BackLink.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { Page } from "../design/Page.js";
import { formatDate } from "../i18n/formatting.js";
import { t } from "../i18n/strings.js";
import { FindPerson } from "./FindPerson.js";
import { RetentionChoiceNotice } from "./RetentionChoiceNotice.js";
import type { PrivacyRequest } from "./privacy.api.js";
import { usePrivacyRequests } from "./privacy.queries.js";

/**
 * Settings → Privacy: finding one person's data first (it's what people come here for), then
 * the four tools, then a short record of requests answered.
 */
export function PrivacyPage() {
  const requests = usePrivacyRequests();
  const recent = requests.data?.requests.slice(0, 5) ?? [];

  return (
    <Page width="readable">
      <BackLink to="/settings">{t("nav.settings")}</BackLink>
      <LargeTitle title={t("privacy.title")} subtitle={t("privacy.subtitle")} />
      <RetentionChoiceNotice />
      <div className="flex flex-col gap-8">
        <FindPerson />
        <GroupedList header={t("privacy.rows.header")}>
          <GroupedListRow
            icon={Database}
            label={t("privacy.rows.map")}
            description={t("privacy.rows.mapDescription")}
            wrapsText
            to="/settings/privacy/data"
          />
          <GroupedListRow
            icon={Clock}
            label={t("privacy.rows.retention")}
            description={t("privacy.rows.retentionDescription")}
            wrapsText
            to="/settings/privacy/retention"
          />
          <GroupedListRow
            icon={FileText}
            label={t("privacy.rows.policy")}
            description={t("privacy.rows.policyDescription")}
            wrapsText
            to="/settings/privacy/policy"
          />
          <GroupedListRow
            icon={Building2}
            label={t("privacy.rows.processors")}
            description={t("privacy.rows.processorsDescription")}
            wrapsText
            to="/settings/privacy/companies"
          />
        </GroupedList>
        {recent.length > 0 && (
          <GroupedList header={t("privacy.requests.header")} footer={t("privacy.requests.footer")}>
            {recent.map((request) => (
              <GroupedListRow
                key={request.id}
                label={t(
                  request.kind === "erase" ? "privacy.requests.erase" : "privacy.requests.export",
                )}
                description={t("privacy.requests.by", {
                  name: request.actorName,
                  date: formatDate(request.createdAt),
                })}
                detail={describeParts(request)}
                wrapsText
              />
            ))}
          </GroupedList>
        )}
        <p className="px-4 text-footnote text-label-secondary">{t("privacy.footnote")}</p>
      </div>
    </Page>
  );
}

/** "Form entries, Orders": the kinds of data the request touched. */
function describeParts(request: PrivacyRequest): string {
  return request.parts.map((part) => part.source).join(", ");
}
