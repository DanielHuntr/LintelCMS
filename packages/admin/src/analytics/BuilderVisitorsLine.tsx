import { t } from "../i18n/strings.js";
import { useOptionalSession } from "../session/SessionContext.js";
import { hasPermission } from "@lintel/core/permissions";
import { useEntryVisitorStats } from "./analytics.queries.js";

/**
 * "128 visitors this week" in the builder's toolbar, for a page with visitors, while the
 * Visitors plugin is on and the person may see it. Nothing at all otherwise.
 */
export function BuilderVisitorsLine({ entryId }: { entryId: string }) {
  const session = useOptionalSession();
  const allowed =
    session !== null &&
    session.enabledPlugins.includes("analytics") &&
    hasPermission(session.permissions, "analytics:read");
  const stats = useEntryVisitorStats(entryId, allowed);
  if (!allowed || !stats.data || stats.data.path === null || stats.data.totals.visitors === 0) {
    return null;
  }
  return (
    <span className="hidden text-footnote text-label-secondary lg:inline">
      {t("visitors.builder.week", { visitors: stats.data.totals.visitors })}
    </span>
  );
}
