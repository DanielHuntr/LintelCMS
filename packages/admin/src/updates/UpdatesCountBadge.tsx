import { Badge } from "../design/Badge.js";
import { useUpdateSummary } from "./updates.queries.js";

/** The number of updates beside Settings → Updates; red when one is a security fix. */
export function UpdatesCountBadge() {
  const summary = useUpdateSummary();
  if (!summary.data || summary.data.count === 0) return null;
  return (
    <Badge tone={summary.data.securityCount > 0 ? "danger" : "accent"}>{summary.data.count}</Badge>
  );
}
