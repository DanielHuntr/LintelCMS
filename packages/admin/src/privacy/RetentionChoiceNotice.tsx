import { Link } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { useRetention } from "./privacy.queries.js";

/**
 * After an upgrade every retention rule is off until the owner chooses, so nothing is deleted
 * that nobody asked to delete. Said on the Dashboard and in Settings → Privacy until then.
 */
export function RetentionChoiceNotice() {
  const canManage = useCan("privacy:manage");
  const retention = useRetention({ enabled: canManage });
  if (!canManage || !retention.data?.needsChoice) return null;
  return (
    <p
      role="status"
      className="mb-4 flex items-start gap-3 rounded-card bg-warning/14 p-4 text-body text-label"
    >
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
      <span>
        {t("privacy.retention.upgradeNotice")}{" "}
        <Link to="/settings/privacy/retention" className="text-accent underline">
          {t("privacy.retention.upgradeLink")}
        </Link>
      </span>
    </p>
  );
}
