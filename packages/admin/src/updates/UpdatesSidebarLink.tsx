import { Link } from "@tanstack/react-router";
import { ArrowUpCircle, ShieldAlert } from "lucide-react";
import { t } from "../i18n/strings.js";
import { useUpdateSummary } from "./updates.queries.js";

/**
 * "2 updates" in the sidebar, for owners and admins, while there is something to install.
 * Red with a shield when one of them fixes a security problem.
 */
export function UpdatesSidebarLink() {
  const summary = useUpdateSummary();
  const count = summary.data?.count ?? 0;
  if (count === 0) return null;
  const security = (summary.data?.securityCount ?? 0) > 0;
  const Icon = security ? ShieldAlert : ArrowUpCircle;
  return (
    <div className="px-2.5 pb-2">
      <Link
        to="/settings/updates"
        aria-label={
          security
            ? t("updates.sidebarLinkSecurity", { count })
            : t("updates.sidebarLink", { count })
        }
        className={`flex h-9 items-center gap-2.5 rounded-control px-2.5 text-body font-medium transition-colors duration-150 ease-standard focus-visible:focus-ring ${
          security
            ? "bg-danger/12 text-danger hover:bg-danger/18"
            : "bg-accent/12 text-accent hover:bg-accent/18"
        }`}
      >
        <Icon aria-hidden="true" strokeWidth={1.75} className="size-[18px] shrink-0" />
        <span className="flex-1">{t("updates.title")}</span>
        <span
          aria-hidden="true"
          className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-caption font-semibold text-on-accent ${
            security ? "bg-danger" : "bg-accent-fill"
          }`}
        >
          {count}
        </span>
      </Link>
    </div>
  );
}
