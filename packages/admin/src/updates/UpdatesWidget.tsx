import { CircleCheck, ShieldAlert } from "lucide-react";
import { LoadError } from "../api/LoadError.js";
import { LinkButton } from "../design/LinkButton.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useAbout, useUpdateSummary } from "./updates.queries.js";

/** The dashboard's Updates widget: "2 updates available · 1 security", or up to date. */
export function UpdatesWidget() {
  const summary = useUpdateSummary();
  const about = useAbout();

  if (summary.isError) {
    return <LoadError error={summary.error} onRetry={() => void summary.refetch()} />;
  }
  if (!summary.data) {
    return (
      <LoadingRegion label={t("updates.loading")}>
        <Skeleton className="h-12 w-full" />
      </LoadingRegion>
    );
  }
  const { count, securityCount } = summary.data;
  if (count === 0) {
    return (
      <p className="flex items-center gap-2 text-body text-label">
        <CircleCheck aria-hidden="true" strokeWidth={1.75} className="size-5 text-success" />
        {t("dashboard.updates.upToDate", { version: about.data?.version ?? "" })}
      </p>
    );
  }
  const available = t("updates.available", { count });
  const security = t("updates.securityCount", { count: securityCount });
  return (
    <div className="flex flex-col items-start gap-4">
      <p className="flex items-center gap-2 text-headline text-label">
        {securityCount > 0 && (
          <ShieldAlert
            aria-hidden="true"
            strokeWidth={1.75}
            className="size-5 shrink-0 text-danger"
          />
        )}
        {securityCount > 0
          ? t("dashboard.updates.summarySecurity", { available, security })
          : available}
      </p>
      <LinkButton to="/settings/updates" variant="tinted" size="small">
        {t("dashboard.updates.open")}
      </LinkButton>
    </div>
  );
}
