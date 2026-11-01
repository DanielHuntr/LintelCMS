import { Download, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { Pagination } from "../content/Pagination.js";
import { formatDateTime } from "../content/relativeTime.js";
import { BackLink } from "../design/BackLink.js";
import { buttonClasses } from "../design/Button.js";
import { EmptyState } from "../design/EmptyState.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { SelectField } from "../design/SelectField.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import {
  describeSecurityEvent,
  securityEventKinds,
  securityEventName,
} from "./describeSecurityEvent.js";
import { securityLogExportUrl } from "./securityLog.api.js";
import { useSecurityEvents } from "./securityLog.queries.js";

const ALL = "all";

/** Settings → Security log: sign-ins, failures and every change to people and access. */
export function SecurityLogPage() {
  const [kind, setKind] = useState(ALL);
  const [page, setPage] = useState(1);
  const filter = { kind: kind === ALL ? undefined : kind, page };
  const events = useSecurityEvents(filter);
  const pageCount = events.data ? Math.ceil(events.data.total / events.data.perPage) : 1;

  return (
    <>
      <BackLink to="/settings">{t("nav.settings")}</BackLink>
      <LargeTitle
        title={t("securityLog.title")}
        subtitle={t("securityLog.subtitle")}
        actions={
          <a href={securityLogExportUrl(filter.kind)} download className={buttonClasses("tinted")}>
            <Download aria-hidden="true" strokeWidth={2} className="size-4" />
            {t("securityLog.export")}
          </a>
        }
      />
      <div className="flex max-w-4xl flex-col gap-6">
        <SelectField
          className="max-w-xs"
          label={t("securityLog.filter")}
          value={kind}
          onValueChange={(next) => {
            setKind(next);
            setPage(1);
          }}
          options={[
            { value: ALL, label: t("securityLog.allEvents") },
            ...securityEventKinds.map((value) => ({ value, label: securityEventName(value) })),
          ]}
        />
        {events.isError && <LoadError error={events.error} onRetry={() => void events.refetch()} />}
        {events.isPending && (
          <LoadingRegion label={t("securityLog.loading")}>
            <Skeleton className="h-64 rounded-card" />
          </LoadingRegion>
        )}
        {events.data?.events.length === 0 && (
          <div className="rounded-card bg-surface">
            <EmptyState
              icon={ShieldCheck}
              title={t("securityLog.emptyTitle")}
              description={t("securityLog.emptyDescription")}
            />
          </div>
        )}
        {events.data && events.data.events.length > 0 && (
          <div className="overflow-x-auto rounded-card bg-surface">
            <table className="w-full text-left text-footnote">
              <caption className="sr-only">{t("securityLog.title")}</caption>
              <thead className="text-label-secondary">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t("securityLog.column.when")}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t("securityLog.column.event")}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t("securityLog.column.who")}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t("securityLog.column.details")}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t("securityLog.column.from")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {events.data.events.map((event) => (
                  <tr key={event.id} className="hairline-top align-top">
                    <td className="px-4 py-3 whitespace-nowrap text-label-secondary">
                      {formatDateTime(event.createdAt)}
                    </td>
                    <td
                      className={
                        event.kind.endsWith("-failed")
                          ? "px-4 py-3 font-medium text-danger"
                          : "px-4 py-3 text-label"
                      }
                    >
                      {securityEventName(event.kind)}
                    </td>
                    <td className="px-4 py-3 text-label">
                      {event.actor.email ?? t("securityLog.someone")}
                    </td>
                    <td className="px-4 py-3 text-label-secondary">
                      {describeSecurityEvent(event)}
                    </td>
                    <td className="px-4 py-3 text-label-secondary">{event.ipAddress ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
      </div>
    </>
  );
}
